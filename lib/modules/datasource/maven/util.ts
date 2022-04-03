import url from 'url';
import is from '@sindresorhus/is';
import { DateTime } from 'luxon';
import { XmlDocument, XmlElement } from 'xmldoc';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { Http } from '../../../util/http';
import type { HttpResponse } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { parsePom } from '../../manager/maven/extract';
import { normalizeDate } from '../metadata';

import type { ReleaseResult } from '../types';
import { MAVEN_REPO } from './common';
import type {
  HttpResourceCheckResult,
  MavenDependency,
  MavenXml,
} from './types';

const getHost = (x: string): string => new url.URL(x).host;

function isMavenCentral(pkgUrl: url.URL | string): boolean {
  const host = typeof pkgUrl === 'string' ? pkgUrl : pkgUrl.host;
  return getHost(MAVEN_REPO) === host;
}

function isTemporalError(err: { code: string; statusCode: number }): boolean {
  return (
    err.code === 'ECONNRESET' ||
    err.statusCode === 429 ||
    (err.statusCode >= 500 && err.statusCode < 600)
  );
}

function isHostError(err: { code: string }): boolean {
  return err.code === 'ETIMEDOUT';
}

function isNotFoundError(err: { code: string; statusCode: number }): boolean {
  return err.code === 'ENOTFOUND' || err.statusCode === 404;
}

function isPermissionsIssue(err: { statusCode: number }): boolean {
  return err.statusCode === 401 || err.statusCode === 403;
}

function isConnectionError(err: { code: string }): boolean {
  return (
    err.code === 'EAI_AGAIN' ||
    err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    err.code === 'ECONNREFUSED'
  );
}

function isUnsupportedHostError(err: { name: string }): boolean {
  return err.name === 'UnsupportedProtocolError';
}

export async function downloadHttpProtocol(
  http: Http,
  pkgUrl: url.URL | string
): Promise<Partial<HttpResponse>> {
  let raw: HttpResponse;
  try {
    raw = await http.get(pkgUrl.toString());
    return raw;
  } catch (err) {
    const failedUrl = pkgUrl.toString();
    if (err.message === HOST_DISABLED) {
      // istanbul ignore next
      logger.trace({ failedUrl }, 'Host disabled');
    } else if (isNotFoundError(err)) {
      logger.trace({ failedUrl }, `Url not found`);
    } else if (isHostError(err)) {
      // istanbul ignore next
      logger.debug({ failedUrl }, `Cannot connect to host`);
    } else if (isPermissionsIssue(err)) {
      logger.debug(
        { failedUrl },
        'Dependency lookup unauthorized. Please add authentication with a hostRule'
      );
    } else if (isTemporalError(err)) {
      logger.debug({ failedUrl, err }, 'Temporary error');
      if (isMavenCentral(pkgUrl)) {
        throw new ExternalHostError(err);
      }
    } else if (isConnectionError(err)) {
      // istanbul ignore next
      logger.debug({ failedUrl }, 'Connection refused to maven registry');
    } else if (isUnsupportedHostError(err)) {
      // istanbul ignore next
      logger.debug({ failedUrl }, 'Unsupported host');
    } else {
      logger.info({ failedUrl, err }, 'Unknown error');
    }
    return {};
  }
}

export async function checkHttpResource(
  http: Http,
  pkgUrl: url.URL | string
): Promise<HttpResourceCheckResult> {
  try {
    const url = pkgUrl.toString();
    const res = await http.get(url);
    const timestamp = res?.headers?.['last-modified'];
    if (timestamp) {
      const isoTimestamp = normalizeDate(timestamp);
      if (isoTimestamp) {
        const releaseDate = DateTime.fromISO(isoTimestamp, {
          zone: 'UTC',
        }).toJSDate();
        return releaseDate;
      }
    }
    return 'found';
  } catch (err) {
    if (isNotFoundError(err)) {
      return 'not-found';
    }

    const failedUrl = pkgUrl.toString();
    logger.debug(
      { failedUrl, statusCode: err.statusCode },
      `Can't check HTTP resource existence`
    );
    return 'error';
  }
}

function containsPlaceholder(str: string): boolean {
  return regEx(/\${.*?}/g).test(str);
}

export function getMavenUrl(
  dependency: MavenDependency,
  repoUrl: string,
  path: string
): url.URL {
  return new url.URL(`${dependency.dependencyUrl}/${path}`, repoUrl);
}

export async function downloadMavenXml(
  http: Http,
  pkgUrl: url.URL | null
): Promise<MavenXml> {
  /* istanbul ignore if */
  if (!pkgUrl) {
    return {};
  }
  let rawContent: string | undefined;
  let authorization: boolean | undefined;
  let statusCode: number | undefined;
  switch (pkgUrl.protocol) {
    case 'http:':
    case 'https:':
      ({
        authorization,
        body: rawContent,
        statusCode,
      } = await downloadHttpProtocol(http, pkgUrl));
      break;
    case 's3:':
      logger.debug('Skipping s3 dependency');
      return {};
    default:
      logger.debug({ url: pkgUrl.toString() }, `Unsupported Maven protocol`);
      return {};
  }

  if (!rawContent) {
    logger.debug(
      { url: pkgUrl.toString(), statusCode },
      `Content is not found for Maven url`
    );
    return {};
  }

  return { authorization, xml: new XmlDocument(rawContent) };
}

export function getDependencyParts(packageName: string): MavenDependency {
  const [group, name] = packageName.split(':');
  const dependencyUrl = `${group.replace(regEx(/\./g), '/')}/${name}`;
  return {
    display: packageName,
    group,
    name,
    dependencyUrl,
  };
}

export async function getDependencyInfo(
  http: Http,
  dependency: MavenDependency,
  repoUrl: string,
  version: string,
  recursionLimit = 5
): Promise<Partial<ReleaseResult>> {
  const result: Partial<ReleaseResult> = {};
  const path = `${version}/${dependency.name}-${version}.pom`;

  const pomUrl = getMavenUrl(dependency, repoUrl, path);
  const { xml: pomContent } = await downloadMavenXml(http, pomUrl);
  // istanbul ignore if
  if (!pomContent) {
    return result;
  }

  const homepage = pomContent.valueWithPath('url');
  if (homepage && !containsPlaceholder(homepage)) {
    result.homepage = homepage;
  }

  const sourceUrl = pomContent.valueWithPath('scm.url');
  if (sourceUrl && !containsPlaceholder(sourceUrl)) {
    result.sourceUrl = sourceUrl
      .replace(regEx(/^scm:/), '')
      .replace(regEx(/^git:/), '')
      .replace(regEx(/^git@github.com:/), 'https://github.com/')
      .replace(regEx(/^git@github.com\//), 'https://github.com/')
      .replace(regEx(/\.git$/), '');

    if (result.sourceUrl.startsWith('//')) {
      // most likely the result of us stripping scm:, git: etc
      // going with prepending https: here which should result in potential information retrival
      result.sourceUrl = `https:${result.sourceUrl}`;
    }
  }

  const parent = pomContent.childNamed('parent');
  if (recursionLimit > 0 && parent && (!result.sourceUrl || !result.homepage)) {
    // if we found a parent and are missing some information
    // trying to get the scm/homepage information from it
    const [parentGroupId, parentArtifactId, parentVersion] = [
      'groupId',
      'artifactId',
      'version',
    ].map((k) => parent.valueWithPath(k)?.replace(/\s+/g, ''));
    if (parentGroupId && parentArtifactId && parentVersion) {
      const parentDisplayId = `${parentGroupId}:${parentArtifactId}`;
      const parentDependency = getDependencyParts(parentDisplayId);
      const parentInformation = await getDependencyInfo(
        http,
        parentDependency,
        repoUrl,
        parentVersion,
        recursionLimit - 1
      );
      if (!result.sourceUrl && parentInformation.sourceUrl) {
        result.sourceUrl = parentInformation.sourceUrl;
      }
      if (!result.homepage && parentInformation.homepage) {
        result.homepage = parentInformation.homepage;
      }
    }
  }

  return result;
}

function getPomXmlUrl(
  group: string,
  artifact: string,
  version: string
): string {
  const groupPath = group.replaceAll('.', '/');
  const basePath = 'https://repo.maven.apache.org/maven2';
  const urlStr = `${basePath}/${groupPath}/${artifact}/${version}/${artifact}-${version}.pom`;
  return urlStr;
}

async function fetchPomXml(
  http: Http,
  url: string
): Promise<XmlDocument | null> {
  let result: null | XmlDocument = null;
  try {
    const { body: rawXml } = await http.get(url);
    result = parsePom(rawXml);
  } catch (err) {
    logger.error(`Can't fetch XML: ${url}`);
  }

  return result;
}

const xmlCache: Record<string, Promise<XmlDocument | null>> = {};

function getPomXml(http: Http, url: string): Promise<XmlDocument | null> {
  const cachedResult = xmlCache[url];
  if (is.promise<XmlDocument | null>(cachedResult)) {
    return cachedResult;
  }
  const result = fetchPomXml(http, url);
  xmlCache[url] = result;
  return result;
}

const cachedProps: Record<string, Record<string, string>> = {};

function applyXmlProps(input: string, props: Record<string, string>): string {
  return input.replace(regEx(/\${.*?}/g), (substr) => {
    const propKey = substr.slice(2, -1).trim();
    const propValue = props[propKey];
    return propValue ? propValue : substr;
  });
}

async function getPomXmlProperties(
  http: Http,
  url: string
): Promise<Record<string, string>> {
  if (cachedProps[url]) {
    return cachedProps[url];
  }

  const pomXml = await getPomXml(http, url);
  const props: Record<string, string> = {};
  if (pomXml) {
    const parent = pomXml.descendantWithPath('parent');
    if (parent) {
      const parentGroup = parent.valueWithPath('groupId');
      const parentArtifact = parent.valueWithPath('artifactId');
      const parentVersion = parent.valueWithPath('version');
      if (parentGroup && parentArtifact && parentVersion) {
        const parentUrl = getPomXmlUrl(
          parentGroup,
          parentArtifact,
          parentVersion
        );

        const parentProps = await getPomXmlProperties(http, parentUrl);
        Object.assign(props, parentProps);
      }
    }

    const projectGroupId = pomXml.valueWithPath('groupId');
    if (projectGroupId) {
      props['project.groupId'] = projectGroupId;
    }

    const projectArtifactId = pomXml.valueWithPath('artifactId');
    if (projectArtifactId) {
      props['project.artifactId'] = projectArtifactId;
    }

    const projectVersion = pomXml.valueWithPath('version');
    if (projectVersion) {
      props['project.version'] = projectVersion;
    }

    const propsElem = pomXml.descendantWithPath('properties');
    propsElem?.eachChild((elem: XmlElement) => {
      if (elem.type === 'element') {
        props[elem.name] = applyXmlProps(elem.val, props);
      }
    });
  }

  cachedProps[url] = props;
  return props;
}

async function visitAllDependencies(
  root: XmlElement,
  cb: (elem: XmlElement) => Promise<void>
): Promise<void> {
  if (root.type === 'element') {
    if (root.name === 'dependencies') {
      await cb(root);
    } else {
      for (const child of root.children) {
        if (child.type === 'element') {
          await visitAllDependencies(child, cb);
        }
      }
    }
  }
}

export async function getPomXmlDependencies(
  http: Http,
  group: string,
  artifact: string,
  version: string
): Promise<Record<string, string> | null> {
  const url = getPomXmlUrl(group, artifact, version);
  const pomXml = await getPomXml(http, url);
  if (!pomXml) {
    return null;
  }

  const deps: Record<string, string> = {};
  const cb = async (depsRoot: XmlElement): Promise<void> => {
    const props = await getPomXmlProperties(http, url);
    depsRoot.eachChild((depElem) => {
      if (depElem.type === 'element' && depElem.name === 'dependency') {
        const depGroup = depElem.valueWithPath('groupId');
        const depArtifact = depElem.valueWithPath('artifactId');
        const depVersion = depElem.valueWithPath('version');
        if (depGroup && depArtifact && depVersion) {
          const key = applyXmlProps(`${depGroup}:${depArtifact}`, props);
          const val = applyXmlProps(depVersion, props);
          deps[key] = val;
        }
      }
    });
  };
  await visitAllDependencies(pomXml, cb);

  return deps;
}
