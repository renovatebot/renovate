// Most of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

const got = require('got');
const url = require('url');
const registryUrl = require('registry-url');
const registryAuthToken = require('registry-auth-token');

module.exports = {
  setNpmrc,
  getDependency,
  resetCache,
};

let npmCache = {};
let npmrc = null;

function resetCache() {
  npmCache = {};
}

async function setNpmrc(input) {
  npmrc = input;
}

async function getDependency(name, logger) {
  logger.debug(`getDependency(${name})`);
  const scope = name.split('/')[0];
  const regUrl = registryUrl(scope, { npmrc });
  const pkgUrl = url.resolve(
    regUrl,
    encodeURIComponent(name).replace(/^%40/, '@')
  );
  const authInfo = registryAuthToken(regUrl, { npmrc });
  const headers = {};

  // Reduce metadata https://github.com/npm/registry/blob/master/docs/responses/package-metadata.md
  // Use `Accept` with JSON has fallback for content format. This allows users of `renovate` to work with package
  // registries that don't support the new `npm.install` content type.
  headers.accept =
    'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*';

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
    logger.trace({ dependency: dep }, JSON.stringify(dep));
    return dep;
  } catch (err) {
    logger.warn(`Dependency not found: ${name}`);
    logger.debug(`err: ${JSON.stringify(err)}`);
    return null;
  }
}
