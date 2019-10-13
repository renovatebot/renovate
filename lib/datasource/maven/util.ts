import url from 'url';
import got from '../../util/got';
import { logger } from '../../logger';

function isMavenCentral(pkgUrl: url.URL | string) {
  return (
    (typeof pkgUrl === 'string' ? pkgUrl : pkgUrl.host) === 'central.maven.org'
  );
}

function isTemporalError(err: { code: string; statusCode: number }) {
  return (
    err.code === 'ECONNRESET' ||
    err.statusCode === 429 ||
    (err.statusCode >= 500 && err.statusCode < 600)
  );
}

function isHostError(err: { code: string }) {
  return err.code === 'ETIMEDOUT';
}

function isNotFoundError(err: { code: string; statusCode: number }) {
  return err.code === 'ENOTFOUND' || err.statusCode === 404;
}

function isPermissionsIssue(err: { statusCode: number }) {
  return err.statusCode === 401 || err.statusCode === 403;
}

function isConnectionError(err: { code: string }) {
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
          (options: any) => {
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
    if (isNotFoundError(err)) {
      logger.debug(`Url not found ${pkgUrl}`);
    } else if (isHostError(err)) {
      // istanbul ignore next
      logger.warn({ pkgUrl }, `Cannot connect to ${hostType} host`);
    } else if (isPermissionsIssue(err)) {
      logger.warn(
        { pkgUrl },
        'Dependency lookup unauthorized. Please add authentication with a hostRule'
      );
    } else if (isTemporalError(err)) {
      logger.info({ err }, `Temporary error requesting ${pkgUrl}`);
      if (isMavenCentral(pkgUrl)) {
        throw new Error('registry-failure');
      }
    } else if (isConnectionError(err)) {
      // istanbul ignore next
      logger.info({ pkgUrl }, 'Connection refused to maven registry');
    } else {
      logger.warn({ err }, `Unknown error requesting ${pkgUrl}`);
    }
    return null;
  }
  return raw.body;
}
