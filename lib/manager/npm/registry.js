// Much of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

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

let map = new Map();

let npmrc = null;

function resetCache() {
  map = new Map();
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

  // Retrieve from API if not cached
  try {
    const res = (await got(pkgUrl, {
      cache: map,
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
    logger.trace({ dependency: dep }, 'dependency');
    return dep;
  } catch (err) {
    logger.debug({ err }, `Dependency not found: ${name}`);
    return null;
  }
}
