import url from 'url';
import fs from 'fs-extra';
import { XmlDocument } from 'xmldoc';
import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http, HttpResponse } from '../../util/http';

import type { ReleaseResult } from '../types';
import { MAVEN_REPO, id } from './common';
import type { MavenDependency, MavenXml } from './types';

const http: Record<string, Http> = {};

function httpByHostType(hostType: string): Http {
  if (!http[hostType]) {
    http[hostType] = new Http(hostType);
  }
  return http[hostType];
}

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
  pkgUrl: url.URL | string,
  hostType = id
): Promise<Partial<HttpResponse>> {
  let raw: HttpResponse;
  try {
    const httpClient = httpByHostType(hostType);
    raw = await httpClient.get(pkgUrl.toString());
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
      logger.debug({ failedUrl }, `Cannot connect to ${hostType} host`);
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

async function downloadFileProtocol(pkgUrl: url.URL): Promise<string | null> {
  const pkgPath = pkgUrl.toString().replace('file://', '');
  if (!(await fs.exists(pkgPath))) {
    return null;
  }
  return fs.readFile(pkgPath, 'utf8');
}

export async function isHttpResourceExists(
  pkgUrl: url.URL | string,
  hostType = id
): Promise<boolean | string | null> {
  try {
    const httpClient = httpByHostType(hostType);
    const res = await httpClient.head(pkgUrl.toString());
    const pkgUrlHost = url.parse(pkgUrl.toString()).host;
    if (pkgUrlHost === 'repo.maven.apache.org') {
      const timestamp = res?.headers?.['last-modified'] as string;
      return timestamp || true;
    }
    return true;
  } catch (err) {
    if (isNotFoundError(err)) {
      return false;
    }

    const failedUrl = pkgUrl.toString();
    logger.debug({ failedUrl }, `Can't check HTTP resource existence`);
    return null;
  }
}

function containsPlaceholder(str: string): boolean {
  return /\${.*?}/g.test(str);
}

export function getMavenUrl(
  dependency: MavenDependency,
  repoUrl: string,
  path: string
): url.URL | null {
  return new url.URL(`${dependency.dependencyUrl}/${path}`, repoUrl);
}

export async function downloadMavenXml(
  pkgUrl: url.URL | null
): Promise<MavenXml | null> {
  /* istanbul ignore if */
  if (!pkgUrl) {
    return {};
  }
  let rawContent: string;
  let authorization: boolean;
  switch (pkgUrl.protocol) {
    case 'file:':
      rawContent = await downloadFileProtocol(pkgUrl);
      break;
    case 'http:':
    case 'https:':
      ({ authorization, body: rawContent } = await downloadHttpProtocol(
        pkgUrl
      ));
      break;
    case 's3:':
      logger.debug('Skipping s3 dependency');
      return {};
    default:
      logger.debug({ url: pkgUrl.toString() }, `Unsupported Maven protocol`);
      return {};
  }

  if (!rawContent) {
    logger.debug(`Content is not found for Maven url: ${pkgUrl.toString()}`);
    return {};
  }

  return { authorization, xml: new XmlDocument(rawContent) };
}

export async function getDependencyInfo(
  dependency: MavenDependency,
  repoUrl: string,
  version: string
): Promise<Partial<ReleaseResult>> {
  const result: Partial<ReleaseResult> = {};
  const path = `${version}/${dependency.name}-${version}.pom`;

  const pomUrl = getMavenUrl(dependency, repoUrl, path);
  const { xml: pomContent } = await downloadMavenXml(pomUrl);
  if (!pomContent) {
    return result;
  }

  const homepage = pomContent.valueWithPath('url');
  if (homepage && !containsPlaceholder(homepage)) {
    result.homepage = homepage;
  }

  const sourceUrl = pomContent.valueWithPath('scm.url');
  if (sourceUrl && !containsPlaceholder(sourceUrl)) {
    result.sourceUrl = sourceUrl.replace(/^scm:/, '');
  }

  return result;
}

export function getDependencyParts(lookupName: string): MavenDependency {
  const [group, name] = lookupName.split(':');
  const dependencyUrl = `${group.replace(/\./g, '/')}/${name}`;
  return {
    display: lookupName,
    group,
    name,
    dependencyUrl,
  };
}
