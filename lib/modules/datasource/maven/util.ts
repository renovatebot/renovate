import { Readable } from 'node:stream';
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { DateTime } from 'luxon';
import { XmlDocument } from 'xmldoc';
import { HOST_DISABLED } from '../../../constants/error-messages';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { type Http, HttpError } from '../../../util/http';
import type { HttpOptions, HttpResponse } from '../../../util/http/types';
import { regEx } from '../../../util/regex';
import { Result } from '../../../util/result';
import type { S3UrlParts } from '../../../util/s3';
import { getS3Client, parseS3Url } from '../../../util/s3';
import { streamToString } from '../../../util/streams';
import { ensureTrailingSlash, parseUrl } from '../../../util/url';
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

function isTemporaryError(err: HttpError): boolean {
  if (err.code === 'ECONNRESET') {
    return true;
  }

  if (err.response) {
    const status = err.response.statusCode;
    return status === 429 || (status >= 500 && status < 600);
  }

  return false;
}

function isHostError(err: HttpError): boolean {
  return err.code === 'ETIMEDOUT';
}

function isNotFoundError(err: HttpError): boolean {
  return err.code === 'ENOTFOUND' || err.response?.statusCode === 404;
}

function isPermissionsIssue(err: HttpError): boolean {
  const status = err.response?.statusCode;
  return status === 401 || status === 403;
}

function isConnectionError(err: HttpError): boolean {
  return (
    err.code === 'EAI_AGAIN' ||
    err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    err.code === 'ECONNREFUSED'
  );
}

function isUnsupportedHostError(err: HttpError): boolean {
  return err.name === 'UnsupportedProtocolError';
}

export async function downloadHttpProtocol(
  http: Http,
  pkgUrl: URL | string,
  opts: HttpOptions = {},
): Promise<HttpResponse | null> {
  const url = pkgUrl.toString();
  const res = await Result.wrap(http.get(url, opts))
    .onError((err) => {
      // istanbul ignore next: never happens, needs for type narrowing
      if (!(err instanceof HttpError)) {
        return;
      }

      const failedUrl = url;
      if (err.message === HOST_DISABLED) {
        logger.trace({ failedUrl }, 'Host disabled');
        return;
      }

      if (isNotFoundError(err)) {
        logger.trace({ failedUrl }, `Url not found`);
        return;
      }

      if (isHostError(err)) {
        logger.debug(`Cannot connect to host ${failedUrl}`);
        return;
      }

      if (isPermissionsIssue(err)) {
        logger.debug(
          `Dependency lookup unauthorized. Please add authentication with a hostRule for ${failedUrl}`,
        );
        return;
      }

      if (isTemporaryError(err)) {
        logger.debug({ failedUrl, err }, 'Temporary error');
        return;
      }

      if (isConnectionError(err)) {
        logger.debug(`Connection refused to maven registry ${failedUrl}`);
        return;
      }

      if (isUnsupportedHostError(err)) {
        logger.debug(`Unsupported host ${failedUrl}`);
        return;
      }

      logger.info({ failedUrl, err }, 'Unknown HTTP download error');
    })
    .catch((err): Result<HttpResponse | 'silent-error', ExternalHostError> => {
      if (
        err instanceof HttpError &&
        isTemporaryError(err) &&
        getHost(url) === getHost(MAVEN_REPO)
      ) {
        return Result.err(new ExternalHostError(err));
      }

      return Result.ok('silent-error');
    })
    .unwrapOrThrow();

  if (res === 'silent-error') {
    return null;
  }

  return res;
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
): Promise<HttpResponse | null> {
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
  s3Url: S3UrlParts,
): Promise<HttpResourceCheckResult> {
  try {
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
        {
          bucket: s3Url.Bucket,
          key: s3Url.Key,
          name: err.name,
          message: err.message,
        },
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

  const s3Url = parseS3Url(parsedUrl);
  if (s3Url) {
    return await checkS3Resource(s3Url);
  }

  if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
    return await checkHttpResource(http, parsedUrl);
  }

  logger.debug(
    { url: pkgUrl.toString() },
    `Unsupported Maven protocol in check resource`,
  );
  return 'not-found';
}

function containsPlaceholder(str: string): boolean {
  return regEx(/\${.*?}/g).test(str);
}

export function getMavenUrl(
  dependency: MavenDependency,
  repoUrl: string,
  path: string,
): URL {
  return new URL(
    `${dependency.dependencyUrl}/${path}`,
    ensureTrailingSlash(repoUrl),
  );
}

export async function downloadMavenXml(
  http: Http,
  pkgUrl: URL | null,
): Promise<MavenXml> {
  if (!pkgUrl) {
    return {};
  }

  const protocol = pkgUrl.protocol;

  if (protocol === 'http:' || protocol === 'https:') {
    const res = await downloadHttpProtocol(http, pkgUrl);
    const body = res?.body;
    if (body) {
      return {
        xml: new XmlDocument(body),
        isCacheable: !res.authorization,
      };
    }
  }

  if (protocol === 'artifactregistry:') {
    const res = await downloadArtifactRegistryProtocol(http, pkgUrl);
    const body = res?.body;
    if (body) {
      return {
        xml: new XmlDocument(body),
        isCacheable: !res.authorization,
      };
    }
  }

  if (protocol === 's3:') {
    const res = await downloadS3Protocol(pkgUrl);
    if (res) {
      return { xml: new XmlDocument(res) };
    }
  }

  logger.debug(
    { url: pkgUrl.toString() },
    `Content is not found for Maven url`,
  );
  return {};
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
  // istanbul ignore if: hard to test
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

  const relocation = pomContent.descendantWithPath(
    'distributionManagement.relocation',
  );
  if (relocation) {
    const newGroup = relocation.valueWithPath('groupId') ?? dependency.group;
    const newName = relocation.valueWithPath('artifactId') ?? dependency.name;
    result.replacementName = newGroup + ':' + newName;
    const relocationVersion = relocation.valueWithPath('version');
    result.replacementVersion = relocationVersion ?? version;
    result.deprecationMessage = relocation.valueWithPath('message');
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
