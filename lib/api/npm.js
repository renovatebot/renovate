// Most of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

const got = require('got');
const url = require('url');
const registryUrl = require('registry-url');
const registryAuthToken = require('registry-auth-token');
const logger = require('winston');

module.exports = {
  getDependency,
  resetCache,
};

let npmCache = {};

function resetCache() {
  npmCache = {};
}

async function getDependency(name) {
  logger.debug(`getDependency(${name})`);
  const scope = name.split('/')[0];
  const regUrl = registryUrl(scope);
  const pkgUrl = url.resolve(
    regUrl,
    encodeURIComponent(name).replace(/^%40/, '@')
  );
  const authInfo = registryAuthToken(regUrl);
  const headers = {};

  // Reduce metadata https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
  headers.accept = 'application/vnd.npm.install-v1+json';

  if (authInfo) {
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
  }

  // Cache based on combinatino of package URL and headers
  const cacheKey = pkgUrl + JSON.stringify(headers);

  // Return from cache if present
  if (npmCache[cacheKey]) {
    logger.debug(`Returning cached version of ${name}`);
    return npmCache[cacheKey];
  }

  // Retrieve from API if not cached
  try {
    const res = await got(pkgUrl, {
      json: true,
      headers,
    });
    // Simpilfy response before caching and returning
    const dep = Object.assign({}, res.body);
    Object.keys(dep.versions).forEach(version => {
      // We don't use any of the version payload currently
      dep.versions[version] = {};
    });
    npmCache[cacheKey] = dep;
    logger.debug(JSON.stringify(dep));
    return dep;
  } catch (err) {
    logger.warn(`Dependency not found: ${name}`);
    logger.debug(`err: ${JSON.stringify(err)}`);
    return null;
  }
}
