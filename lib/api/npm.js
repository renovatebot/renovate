// Most of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

const got = require('got');
const url = require('url');
const ini = require('ini');
const getRegistryUrl = require('registry-auth-token/registry-url');
const registryAuthToken = require('registry-auth-token');
const parse = require('github-url-from-git');

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
  npmrc = ini.parse(input);
}

async function getDependency(name, logger) {
  logger.debug(`getDependency(${name})`);
  const scope = name.split('/')[0];
  let regUrl;
  try {
    regUrl = getRegistryUrl(scope, npmrc);
  } catch (err) {
    regUrl = 'https://registry.npmjs.org';
  }
  const pkgUrl = url.resolve(
    regUrl,
    encodeURIComponent(name).replace(/^%40/, '@')
  );
  const authInfo = registryAuthToken(regUrl, { npmrc });
  const headers = {};

  if (authInfo && authInfo.type && authInfo.token) {
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
  } else if (process.env.NPM_TOKEN && process.env.NPM_TOKEN !== 'undefined') {
    headers.authorization = `Bearer ${process.env.NPM_TOKEN}`;
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
    // Determine repository URL
    let repositoryUrl;
    if (res.body.repository) {
      repositoryUrl = parse(res.body.repository.url);
    }
    if (!repositoryUrl) {
      repositoryUrl = res.body.homepage;
    }
    // Simplify response before caching and returning
    const dep = {
      name: res.body.name,
      homepage: res.body.homepage,
      repositoryUrl,
      versions: res.body.versions,
      'dist-tags': res.body['dist-tags'],
      'renovate-config':
        res.body.versions[res.body['dist-tags'].latest]['renovate-config'],
    };
    Object.keys(dep.versions).forEach(version => {
      // We don't use any of the version payload currently
      dep.versions[version] = { time: res.body.time[version] };
    });
    npmCache[cacheKey] = dep;
    logger.trace({ dependency: dep }, 'dependency');
    return dep;
  } catch (err) {
    logger.debug({ err }, `Dependency not found: ${name}`);
    return null;
  }
}
