const got = require('../../util/got');

module.exports = {
  downloadHttpProtocol,
};

function isMavenCentral(pkgUrl) {
  return pkgUrl.host === 'central.maven.org';
}

function isTemporalError(err) {
  return (
    err.code === 'ECONNRESET' ||
    err.statusCode === 429 ||
    (err.statusCode > 500 && err.statusCode < 600)
  );
}

function isHostError(err) {
  return err.code === 'ETIMEDOUT';
}

function isNotFoundError(err) {
  return err.code === 'ENOTFOUND' || err.statusCode === 404;
}

function isPermissionsIssue(err) {
  return err.statusCode === 401 || err.statusCode === 403;
}

function isConnectionError(err) {
  return err.code === 'ECONNREFUSED';
}

async function downloadHttpProtocol(pkgUrl, hostType = 'maven') {
  let raw;
  try {
    raw = await got(pkgUrl, { hostType });
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
