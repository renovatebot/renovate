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
  resetMemCache,
  resetCache,
};

let map = new Map();

let memcache = {};

let npmrc = null;

function resetMemCache() {
  logger.debug('resetMemCache()');
  memcache = {};
}

function resetCache() {
  map = new Map();
  resetMemCache();
}

function setNpmrc(input, exposeEnv = false) {
  logger.debug('setNpmrc()');
  if (input) {
    npmrc = ini.parse(input);
    if (!exposeEnv) {
      return;
    }
    for (const key in npmrc) {
      if (Object.prototype.hasOwnProperty.call(npmrc, key)) {
        npmrc[key] = envReplace(npmrc[key]);
      }
    }
  } else {
    npmrc = null;
  }
}

function envReplace(value, env = process.env) {

  if (typeof value !== 'string' || !value) {
    return value;
  }

  const ENV_EXPR = /(\\*)\$\{([^}]+)\}/g;

  return value.replace(ENV_EXPR, (match, esc, envVarName) => {
    if (env[envVarName] === undefined) {
      logger.warn('Failed to replace env in config: ' + match);
      throw new Error('env-replace');
    }
    return env[envVarName];
  });
}

async function getDependency(name) {
  logger.trace(`getDependency(${name})`);
  if (memcache[name]) {
    logger.debug('Returning cached result');
    return memcache[name];
  }
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
      cache: process.env.RENOVATE_SKIP_CACHE ? undefined : map,
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
    logger.trace({ dep }, 'dep');
    memcache[name] = dep;
    return dep;
  } catch (err) {
    if (err.statusCode === 401) {
      logger.info({ err, name }, `Dependency lookup unauthorized`);
      return null;
    }
    if (err.statusCode === 404) {
      logger.info({ err, name }, `Dependency not found`);
      return null;
    }
    if (err.name === 'ParseError') {
      // Registry returned a 200 OK but got failed to parse it
      logger.warn({ err }, 'npm registry failure: ParseError');
      throw new Error('registry-failure');
    }
    if (err.statusCode === 429) {
      // This is bad if it ever happens, so we should error
      logger.error({ err }, 'npm registry failure: too many requests');
      throw new Error('registry-failure');
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      logger.warn({ err }, 'npm registry failure: internal error');
      throw new Error('registry-failure');
    }
    logger.warn({ err, name }, 'npm registry failures: Unknown error');
    throw new Error('registry-failure');
  }
}
