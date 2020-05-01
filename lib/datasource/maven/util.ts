import url from 'url';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import { DatasourceError } from '../common';

import { MAVEN_REPO, id } from './common';

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
): Promise<string | null> {
  let raw: { body: string };
  try {
    const httpClient = httpByHostType(hostType);
    raw = await httpClient.get(pkgUrl.toString());
    return raw.body;
  } catch (err) {
    const failedUrl = pkgUrl.toString();
    if (isNotFoundError(err)) {
      logger.debug({ failedUrl }, `Url not found`);
    } else if (isHostError(err)) {
      // istanbul ignore next
      logger.warn({ failedUrl }, `Cannot connect to ${hostType} host`);
    } else if (isPermissionsIssue(err)) {
      logger.warn(
        { failedUrl },
        'Dependency lookup unauthorized. Please add authentication with a hostRule'
      );
    } else if (isTemporalError(err)) {
      logger.debug({ failedUrl, err }, 'Temporary error');
      if (isMavenCentral(pkgUrl)) {
        throw new DatasourceError(err);
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
    return null;
  }
}

export async function isHttpResourceExists(
  pkgUrl: url.URL | string,
  hostType = id
): Promise<boolean | null> {
  try {
    const httpClient = httpByHostType(hostType);
    await httpClient.head(pkgUrl.toString());
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
