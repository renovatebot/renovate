// Much of this borrowed from https://github.com/sindresorhus/package-json/blob/master/index.js

const got = require('got');
const url = require('url');
const ini = require('ini');
const delay = require('delay');
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
    const tokenKey = '//registry.npmjs.org/:_authToken';
    // istanbul ignore if
    if (npmrc && npmrc[tokenKey]) {
      const token = npmrc[tokenKey];
      const maskedToken = `${token.substring(0, 2)}${new Array(
        token.length - 3
      ).join('*')}${token.slice(-2)}`;
      logger.debug(`Setting authToken to ${maskedToken}`);
    }
    if (!exposeEnv) {
      return;
    }
    for (const key in npmrc) {
      if (Object.prototype.hasOwnProperty.call(npmrc, key)) {
        npmrc[key] = envReplace(npmrc[key]);
      }
    }
  } else {
    logger.debug('Resetting npmrc');
    npmrc = null;
  }
}

function envReplace(value, env = process.env) {
  // istanbul ignore if
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

async function getDependency(name, retries = 5) {
  logger.trace(`getDependency(${name})`);
  if (memcache[name]) {
    logger.trace('Returning cached result');
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
      retries: 5,
      headers,
    })).body;
    if (!res.versions || !Object.keys(res.versions).length) {
      // Registry returned a 200 OK but with no versions
      if (retries <= 0) {
        logger.info({ name }, 'No versions returned');
        return null;
      }
      logger.info('No versions returned, retrying');
      await delay(5000 / retries);
      return getDependency(name, 0);
    }
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
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.info(
        { err, statusCode: err.statusCode, name },
        `Dependency lookup failure: unauthorized`
      );
      return null;
    }
    if (err.statusCode === 404) {
      logger.info({ name }, `Dependency lookup failure: not found`);
      logger.debug({ err });
      return null;
    }
    if (err.name === 'ParseError') {
      // Registry returned a 200 OK but got failed to parse it
      if (retries <= 0) {
        logger.warn({ err }, 'npm registry failure: ParseError');
        throw new Error('registry-failure');
      }
      logger.info({ err }, 'npm registry failure: ParseError, retrying');
      await delay(5000 / retries);
      return getDependency(name, retries - 1);
    }
    if (err.statusCode === 429) {
      // This is bad if it ever happens, so we should error
      logger.error({ err }, 'npm registry failure: too many requests');
      throw new Error('registry-failure');
    }
    if (err.statusCode === 408) {
      if (retries <= 0) {
        logger.warn({ err }, 'npm registry failure: timeout, retries=0');
        throw new Error('registry-failure');
      }
      logger.info({ err }, 'npm registry failure: timeout, retrying');
      await delay(5000 / retries);
      return getDependency(name, retries - 1);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      if (retries <= 0) {
        logger.warn({ err }, 'npm registry failure: internal error, retries=0');
        throw new Error('registry-failure');
      }
      logger.info({ err }, 'npm registry failure: internal error, retrying');
      await delay(5000 / retries);
      return getDependency(name, retries - 1);
    }
    logger.warn({ err, name }, 'npm registry failures: Unknown error');
    throw new Error('registry-failure');
  }
}
