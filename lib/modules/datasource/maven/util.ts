import { Readable } from 'node:stream';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DateTime } from 'luxon';
import { XmlDocument } from 'xmldoc';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import type { Http } from '../../../util/http';
import type { HttpOptions, HttpResponse } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { getS3Client, parseS3Url } from '../../../util/s3';
import { streamToString } from '../../../util/streams';
import { parseUrl } from '../../../util/url';
import { normalizeDate } from '../metadata';
import type { ReleaseResult } from '../types';
import { getGoogleAuthToken } from '../util';
import { MAVEN_REPO } from './common';
import type {
  HttpResourceCheckResult,
  MavenDependency,
  MavenXml,
} from './types';

function getHost(url: string): string | null {
  return parseUrl(url)?.host ?? /* istanbul ignore next: not possible */ null;
}

function isMavenCentral(pkgUrl: URL | string): boolean {
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
  pkgUrl: URL | string,
  opts: HttpOptions = {},
): Promise<Partial<HttpResponse>> {
  let raw: HttpResponse;
  try {
    raw = await http.get(pkgUrl.toString(), opts);
    return raw;
  } catch (err) {
    const failedUrl = pkgUrl.toString();
    if (err.message === HOST_DISABLED) {
      logger.trace({ failedUrl }, 'Host disabled');
    } else if (isNotFoundError(err)) {
      logger.trace({ failedUrl }, `Url not found`);
    } else if (isHostError(err)) {
      logger.debug(`Cannot connect to host ${failedUrl}`);
    } else if (isPermissionsIssue(err)) {
      logger.debug(
        `Dependency lookup unauthorized. Please add authentication with a hostRule for ${failedUrl}`,
      );
    } else if (isTemporalError(err)) {
      logger.debug({ failedUrl, err }, 'Temporary error');
      if (isMavenCentral(pkgUrl)) {
        throw new ExternalHostError(err);
      }
    } else if (isConnectionError(err)) {
      logger.debug(`Connection refused to maven registry ${failedUrl}`);
    } else if (isUnsupportedHostError(err)) {
      logger.debug(`Unsupported host ${failedUrl} `);
    } else {
      logger.info({ failedUrl, err }, 'Unknown HTTP download error');
    }
    return {};
  }
}

function isS3NotFound(err: Error): boolean {
  return err.message === 'NotFound' || err.message === 'NoSuchKey';
}

export async function downloadS3Protocol(pkgUrl: URL): Promise<string | null> {
  logger.trace({ url: pkgUrl.toString() }, `Attempting to load S3 dependency`);
  try {
    const s3Url = parseS3Url(pkgUrl);
    if (s3Url === null) {
      return null;
    }
    const { Body: res } = await getS3Client().send(new GetObjectCommand(s3Url));
    if (res instanceof Readable) {
      return streamToString(res);
    }
    logger.debug(
      `Expecting Readable response type got '${typeof res}' type instead`,
    );
  } catch (err) {
    const failedUrl = pkgUrl.toString();
    if (err.name === 'CredentialsProviderError') {
      logger.debug(
        { failedUrl },
        'Dependency lookup authorization failed. Please correct AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars',
      );
    } else if (err.message === 'Region is missing') {
      logger.debug(
        { failedUrl },
        'Dependency lookup failed. Please a correct AWS_REGION env var',
      );
    } else if (isS3NotFound(err)) {
      logger.trace({ failedUrl }, `S3 url not found`);
    } else {
      logger.debug(
        { failedUrl, message: err.message },
        'Unknown S3 download error',
      );
    }
  }
  return null;
}

export async function downloadArtifactRegistryProtocol(
  http: Http,
  pkgUrl: URL,
): Promise<Partial<HttpResponse>> {
  const opts: HttpOptions = {};
  const host = pkgUrl.host;
  const path = pkgUrl.pathname;

  logger.trace({ host, path }, `Using google auth for Maven repository`);
  const auth = await getGoogleAuthToken();
  if (auth) {
    opts.headers = { authorization: `Basic ${auth}` };
  } else {
    logger.once.debug(
      { host, path },
      'Could not get Google access token, using no auth',
    );
  }

  const url = pkgUrl.toString().replace('artifactregistry:', 'https:');

  return downloadHttpProtocol(http, url, opts);
}

async function checkHttpResource(
  http: Http,
  pkgUrl: URL,
): Promise<HttpResourceCheckResult> {
  try {
    const res = await http.head(pkgUrl.toString());
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
      `Can't check HTTP resource existence`,
    );
    return 'error';
  }
}

export async function checkS3Resource(
  pkgUrl: URL,
): Promise<HttpResourceCheckResult> {
  try {
    const s3Url = parseS3Url(pkgUrl);
    if (s3Url === null) {
      return 'error';
    }
    const response = await getS3Client().send(new HeadObjectCommand(s3Url));
    if (response.DeleteMarker) {
      return 'not-found';
    }
    if (response.LastModified) {
      return response.LastModified;
    }
    return 'found';
  } catch (err) {
    if (isS3NotFound(err)) {
      return 'not-found';
    } else {
      logger.debug(
        { pkgUrl, name: err.name, message: err.message },
        `Can't check S3 resource existence`,
      );
    }
    return 'error';
  }
}

export async function checkResource(
  http: Http,
  pkgUrl: URL | string,
): Promise<HttpResourceCheckResult> {
  const parsedUrl = typeof pkgUrl === 'string' ? parseUrl(pkgUrl) : pkgUrl;
  if (parsedUrl === null) {
    return 'error';
  }
  switch (parsedUrl.protocol) {
    case 'http:':
    case 'https:':
      return await checkHttpResource(http, parsedUrl);
    case 's3:':
      return await checkS3Resource(parsedUrl);
    default:
      logger.debug(
        { url: pkgUrl.toString() },
        `Unsupported Maven protocol in check resource`,
      );
      return 'not-found';
  }
}

function containsPlaceholder(str: string): boolean {
  return regEx(/\${.*?}/g).test(str);
}

export function getMavenUrl(
  dependency: MavenDependency,
  repoUrl: string,
  path: string,
): URL {
  return new URL(`${dependency.dependencyUrl}/${path}`, repoUrl);
}

export async function downloadMavenXml(
  http: Http,
  pkgUrl: URL | null,
): Promise<MavenXml> {
  if (!pkgUrl) {
    return {};
  }

  let isCacheable = false;

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
      rawContent = (await downloadS3Protocol(pkgUrl)) ?? undefined;
      break;
    case 'artifactregistry:':
      ({
        authorization,
        body: rawContent,
        statusCode,
      } = await downloadArtifactRegistryProtocol(http, pkgUrl));
      break;
    default:
      logger.debug(`Unsupported Maven protocol url:${pkgUrl.toString()}`);
      return {};
  }

  if (!rawContent) {
    logger.debug(
      { url: pkgUrl.toString(), statusCode },
      `Content is not found for Maven url`,
    );
    return {};
  }

  if (!authorization) {
    isCacheable = true;
  }

  return { isCacheable, xml: new XmlDocument(rawContent) };
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

function extractSnapshotVersion(metadata: XmlDocument): string | null {
  // Parse the maven-metadata.xml for the snapshot version and determine
  // the fixed version of the latest deployed snapshot.
  // The metadata descriptor can be found at
  // https://maven.apache.org/ref/3.3.3/maven-repository-metadata/repository-metadata.html
  //
  // Basically, we need to replace -SNAPSHOT with the artifact timestanp & build number,
  // so for example 1.0.0-SNAPSHOT will become 1.0.0-<timestamp>-<buildNumber>
  const version = metadata
    .descendantWithPath('version')
    ?.val?.replace('-SNAPSHOT', '');

  const snapshot = metadata.descendantWithPath('versioning.snapshot');
  const timestamp = snapshot?.childNamed('timestamp')?.val;
  const build = snapshot?.childNamed('buildNumber')?.val;

  // If we weren't able to parse out the required 3 version elements,
  // return null because we can't determine the fixed version of the latest snapshot.
  if (!version || !timestamp || !build) {
    return null;
  }
  return `${version}-${timestamp}-${build}`;
}

async function getSnapshotFullVersion(
  http: Http,
  version: string,
  dependency: MavenDependency,
  repoUrl: string,
): Promise<string | null> {
  // To determine what actual files are available for the snapshot, first we have to fetch and parse
  // the metadata located at http://<repo>/<group>/<artifact>/<version-SNAPSHOT>/maven-metadata.xml
  const metadataUrl = getMavenUrl(
    dependency,
    repoUrl,
    `${version}/maven-metadata.xml`,
  );

  const { xml: mavenMetadata } = await downloadMavenXml(http, metadataUrl);
  if (!mavenMetadata) {
    return null;
  }

  return extractSnapshotVersion(mavenMetadata);
}

function isSnapshotVersion(version: string): boolean {
  if (version.endsWith('-SNAPSHOT')) {
    return true;
  }
  return false;
}

export async function createUrlForDependencyPom(
  http: Http,
  version: string,
  dependency: MavenDependency,
  repoUrl: string,
): Promise<string> {
  if (isSnapshotVersion(version)) {
    // By default, Maven snapshots are deployed to the repository with fixed file names.
    // Resolve the full, actual pom file name for the version.
    const fullVersion = await getSnapshotFullVersion(
      http,
      version,
      dependency,
      repoUrl,
    );

    // If we were able to resolve the version, use that, otherwise fall back to using -SNAPSHOT
    if (fullVersion !== null) {
      // TODO: types (#22198)
      return `${version}/${dependency.name}-${fullVersion}.pom`;
    }
  }

  // TODO: types (#22198)
  return `${version}/${dependency.name}-${version}.pom`;
}

export async function getDependencyInfo(
  http: Http,
  dependency: MavenDependency,
  repoUrl: string,
  version: string,
  recursionLimit = 5,
): Promise<Partial<ReleaseResult>> {
  const result: Partial<ReleaseResult> = {};
  const path = await createUrlForDependencyPom(
    http,
    version,
    dependency,
    repoUrl,
  );

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
      .replace(regEx(/^git@github.com\//), 'https://github.com/');

    if (result.sourceUrl.startsWith('//')) {
      // most likely the result of us stripping scm:, git: etc
      // going with prepending https: here which should result in potential information retrival
      result.sourceUrl = `https:${result.sourceUrl}`;
    }
  }

  const groupId = pomContent.valueWithPath('groupId');
  if (groupId) {
    result.packageScope = groupId;
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
        recursionLimit - 1,
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
