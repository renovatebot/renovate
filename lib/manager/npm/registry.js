// Much of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

const got = require('got');
const url = require('url');
const ini = require('ini');
const Keyv = require('keyv');
const getRegistryUrl = require('registry-auth-token/registry-url');
const registryAuthToken = require('registry-auth-token');
const parse = require('github-url-from-git');

const cache = new Keyv({ namespace: 'npm' });

module.exports = {
  setNpmrc,
  getDependency,
  resetCache,
};

let npmrc = null;

function resetCache() {
  cache.clear();
}

function setNpmrc(input) {
  if (input) {
    npmrc = ini.parse(input);
  }
}

async function getDependency(name) {
  logger.trace(`getDependency(${name})`);
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
  const cacheVal = await cache.get(cacheKey);
  if (cacheVal) {
    logger.trace(`Returning cached version of ${name}`);
    return cacheVal;
  }

  // Retrieve from API if not cached
  try {
    const res = (await got(pkgUrl, {
      json: true,
      headers,
    })).body;
    // Determine repository URL
    let repositoryUrl;
    if (res.repository) {
      repositoryUrl = parse(res.repository.url);
    }
    if (!repositoryUrl) {
      repositoryUrl = res.homepage;
    }
    // Simplify response before caching and returning
    const dep = {
      name: res.name,
      homepage: res.homepage,
      repositoryUrl,
      versions: res.versions,
      'dist-tags': res['dist-tags'],
      'renovate-config':
        res.versions[res['dist-tags'].latest]['renovate-config'],
    };
    Object.keys(dep.versions).forEach(version => {
      // We don't use any of the version payload currently
      dep.versions[version] = {
        // fall back to arbitrary time for old npm servers
        time: res.time ? res.time[version] : '2017-01-01T12:00:00.000Z',
      };
    });
    const expiryMs = 5 * 60 * 1000;
    await cache.set(cacheKey, dep, expiryMs);
    logger.trace({ dependency: dep }, 'dependency');
    return dep;
  } catch (err) {
    logger.debug({ err }, `Dependency not found: ${name}`);
    return null;
  }
}
