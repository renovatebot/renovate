import url from 'url';
import got from '../../util/got';
import { logger } from '../../logger';
import { DATASOURCE_FAILURE } from '../../constants/error-messages';

function isMavenCentral(pkgUrl: url.URL | string): boolean {
  return (
    (typeof pkgUrl === 'string' ? pkgUrl : pkgUrl.host) === 'central.maven.org'
  );
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
  return err.code === 'ECONNREFUSED';
}

export async function downloadHttpProtocol(
  pkgUrl: url.URL | string,
  hostType = 'maven'
): Promise<string | null> {
  let raw: { body: string };
  try {
    raw = await got(pkgUrl, {
      hostType,
      hooks: {
        beforeRedirect: [
          (options: any): void => {
            if (
              options.search &&
              options.search.indexOf('X-Amz-Algorithm') !== -1
            ) {
              // maven repository is hosted on amazon, redirect url includes authentication.
              // eslint-disable-next-line no-param-reassign
              delete options.auth;
            }
          },
        ],
      },
    });
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
      logger.info({ failedUrl, err }, 'Temporary error');
      if (isMavenCentral(pkgUrl)) {
        throw new Error(DATASOURCE_FAILURE);
      }
    } else if (isConnectionError(err)) {
      // istanbul ignore next
      logger.info({ failedUrl }, 'Connection refused to maven registry');
    } else {
      logger.warn({ failedUrl, err }, 'Unknown error');
    }
    return null;
  }
  return raw.body;
}
