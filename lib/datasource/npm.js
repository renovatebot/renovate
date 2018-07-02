const is = require('@sindresorhus/is');
const moment = require('moment');
const got = require('got');
const url = require('url');
const ini = require('ini');
const delay = require('delay');
const getRegistryUrl = require('registry-auth-token/registry-url');
const registryAuthToken = require('registry-auth-token');
const parse = require('github-url-from-git');
const { isBase64 } = require('validator');
const { isVersion, sortVersions } = require('../versioning')('semver');

module.exports = {
  maskToken,
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

// istanbul ignore next
function maskToken(token) {
  // istanbul ignore if
  if (!token) {
    return token;
  }
  return `${token.substring(0, 2)}${new Array(token.length - 3).join(
    '*'
  )}${token.slice(-2)}`;
}

function setNpmrc(input, exposeEnv = false) {
  if (input) {
    logger.debug('Setting npmrc');
    npmrc = ini.parse(input);
    // massage _auth to _authToken
    for (const [key, val] of Object.entries(npmrc)) {
      if (key !== '_auth' && key.endsWith('_auth') && isBase64(val)) {
        logger.debug('Massaging _auth to _authToken');
        npmrc[key + 'Token'] = val;
        npmrc.massagedAuth = true;
        delete npmrc[key];
      }
    }
    if (!exposeEnv) {
      return;
    }
    for (const key in npmrc) {
      if (Object.prototype.hasOwnProperty.call(npmrc, key)) {
        npmrc[key] = envReplace(npmrc[key]);
      }
    }
  } else if (npmrc) {
    logger.debug('Resetting npmrc');
    npmrc = null;
  }
}

function envReplace(value, env = process.env) {
  // istanbul ignore if
  if (!is.string(value)) {
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

function getDependency(input, config) {
  const retries = config ? config.retries : undefined;
  if (is.string(input)) {
    const depName = input;
    return getDependencyInner(depName, retries);
  }
  if (config) {
    const exposeEnv = config.global ? config.global.exposeEnv : false;
    setNpmrc(config.npmrc, exposeEnv);
  }
  const purl = input;
  return getDependencyInner(purl.fullname, retries);
}

async function getDependencyInner(name, retries = 5) {
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
    // istanbul ignore if
    if (npmrc && npmrc.massagedAuth && isBase64(authInfo.token)) {
      logger.debug('Massaging authorization type to Basic');
      authInfo.type = 'Basic';
    }
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
      return getDependencyInner(name, 0);
    }

    const latestVersion = res.versions[res['dist-tags'].latest];
    res.repository = res.repository || latestVersion.repository;
    res.homepage = res.homepage || latestVersion.homepage;

    // Determine repository URL
    let repositoryUrl;

    if (res.repository && res.repository.url) {
      const extraBaseUrls = [];
      // istanbul ignore if
      if (process.env.GITHUB_ENDPOINT) {
        const parsedEndpoint = url.parse(process.env.GITHUB_ENDPOINT);
        extraBaseUrls.push(
          parsedEndpoint.hostname,
          `gist.${parsedEndpoint.hostname}`
        );
      }
      // Massage www out of github URL
      res.repository.url = res.repository.url.replace(
        'www.github.com',
        'github.com'
      );
      if (res.repository.url.startsWith('https://github.com/')) {
        res.repository.url = res.repository.url
          .split('/')
          .slice(0, 5)
          .join('/');
      }
      repositoryUrl = parse(res.repository.url, {
        extraBaseUrls,
      });
    }
    // Simplify response before caching and returning
    const dep = {
      name: res.name,
      homepage: res.homepage,
      latestVersion: res['dist-tags'].latest,
      repositoryUrl,
      versions: {},
      'renovate-config': latestVersion['renovate-config'],
    };
    const versions = Object.keys(res.versions)
      .filter(isVersion)
      .sort(sortVersions);
    dep.releases = versions.map(version => {
      const release = {
        version,
        gitRef: res.versions[version].gitHead,
      };
      if (res.time && res.time[version]) {
        release.releaseTimestamp = res.time[version];
        release.canBeUnpublished =
          moment().diff(moment(release.releaseTimestamp), 'days') === 0;
      }
      return release;
    });
    logger.trace({ dep }, 'dep');
    memcache[name] = dep;
    return dep;
  } catch (err) {
    if (err.statusCode === 401 || err.statusCode === 403) {
      logger.info(
        {
          pkgUrl,
          authInfoType: authInfo ? authInfo.type : undefined,
          authInfoToken: authInfo ? maskToken(authInfo.token) : undefined,
          err,
          statusCode: err.statusCode,
          name,
        },
        `Dependency lookup failure: unauthorized`
      );
      return null;
    }
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
        token: authInfo ? maskToken(authInfo.token) : 'none',
      });
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
      return getDependencyInner(name, retries - 1);
    }
    if (err.statusCode === 429) {
      if (retries <= 0) {
        logger.error({ err }, 'npm registry failure: too many requests');
        throw new Error('registry-failure');
      }
      const retryAfter = err.headers['retry-after'] || 30;
      logger.info(
        `npm too many requests. retrying after ${retryAfter} seconds`
      );
      await delay(1000 * (retryAfter + 1));
      return getDependencyInner(name, retries - 1);
    }
    if (err.statusCode === 408) {
      if (retries <= 0) {
        logger.warn({ err }, 'npm registry failure: timeout, retries=0');
        throw new Error('registry-failure');
      }
      logger.info({ err }, 'npm registry failure: timeout, retrying');
      await delay(5000 / retries);
      return getDependencyInner(name, retries - 1);
    }
    if (err.statusCode >= 500 && err.statusCode < 600) {
      if (retries <= 0) {
        logger.warn({ err }, 'npm registry failure: internal error, retries=0');
        throw new Error('registry-failure');
      }
      logger.info({ err }, 'npm registry failure: internal error, retrying');
      await delay(5000 / retries);
      return getDependencyInner(name, retries - 1);
    }
    logger.warn({ err, name }, 'npm registry failure: Unknown error');
    throw new Error('registry-failure');
  }
}
