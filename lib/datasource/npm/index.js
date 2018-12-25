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
const { isVersion, sortVersions } = require('../../versioning/semver');
const hostRules = require('../../util/host-rules');

module.exports = {
  maskToken,
  setNpmrc,
  getPreset,
  getPkgReleases,
  resetMemCache,
  resetCache,
};

let map = new Map();

let memcache = {};

let npmrc = null;
let npmrcRaw;

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

function setNpmrc(input, trustLevel = 'low') {
  if (input) {
    if (input === npmrcRaw) {
      return;
    }
    const existingNpmrc = npmrc;
    npmrcRaw = input;
    logger.debug('Setting npmrc');
    npmrc = ini.parse(input);
    // massage _auth to _authToken
    for (const [key, val] of Object.entries(npmrc)) {
      // istanbul ignore if
      if (
        trustLevel === 'low' &&
        key.endsWith('registry') &&
        val &&
        val.includes('localhost')
      ) {
        logger.info(
          { key, val },
          'Detected localhost registry - rejecting npmrc file'
        );
        npmrc = existingNpmrc;
        return;
      }
      if (key !== '_auth' && key.endsWith('_auth') && isBase64(val)) {
        logger.debug('Massaging _auth to _authToken');
        npmrc[key + 'Token'] = val;
        npmrc.massagedAuth = true;
        delete npmrc[key];
      }
    }
    if (trustLevel !== 'high') {
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
    npmrcRaw = null;
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

async function getPkgReleases(input, config) {
  const retries = config ? config.retries : undefined;
  if (is.string(input)) {
    const depName = input;
    return getDependency(depName, retries);
  }
  if (config) {
    const trustLevel = config.global ? config.global.trustLevel : 'low';
    setNpmrc(config.npmrc, trustLevel);
  }
  const purl = input;
  const res = await getDependency(purl.fullname, retries);
  if (res) {
    res.tags = res['dist-tags'];
    delete res['dist-tags'];
    delete res['renovate-config'];
  }
  return res;
}

async function getPreset(pkgName, presetName = 'default') {
  const dep = await getDependency(pkgName);
  if (!dep) {
    throw new Error('dep not found');
  }
  if (!dep['renovate-config']) {
    throw new Error('preset renovate-config not found');
  }
  const presetConfig = dep['renovate-config'][presetName];
  if (!presetConfig) {
    throw new Error('preset not found');
  }
  return presetConfig;
}

async function getDependency(name, maxRetries = 5) {
  let retries = maxRetries;
  logger.trace(`npm.getDependency(${name})`);

  // This is our datastore cache and is cleared at the end of each repo, i.e. we never requery/revalidate during a "run"
  if (memcache[name]) {
    logger.trace('Returning cached result');
    return JSON.parse(memcache[name]);
  }

  // Now check the persistent cache
  const cacheNamespace = 'datasource-npm';
  const cachedResult = await renovateCache.get(cacheNamespace, name);
  if (cachedResult) {
    return cachedResult;
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

  if (
    pkgUrl.startsWith('https://registry.npmjs.org') &&
    !pkgUrl.startsWith('https://registry.npmjs.org/@')
  ) {
    // Delete the authorization header for non-scoped public packages to improve http caching
    // Otherwise, authenticated requests are not cacheable until the registry adds "public" to Cache-Control
    // Ref: https://greenbytes.de/tech/webdav/rfc7234.html#caching.authenticated.responses
    delete headers.authorization;
  }

  // This tells our http layer not to serve responses directly from the cache and instead to revalidate them every time
  headers['Cache-Control'] = 'no-cache';

  try {
    const raw = await got(pkgUrl, {
      cache: process.env.RENOVATE_SKIP_CACHE ? undefined : map,
      json: true,
      retry: {
        retries: (retry, err) => {
          if (retries <= 0) {
            return 0;
          }
          let delayUnit = 1000;
          if (process.env.NODE_ENV === 'test') {
            delayUnit = 1;
          }
          const defaultDelay = (5 * delayUnit) / retries;
          retries -= 1;
          // istanbul ignore if
          if (
            err.code === 'ETIMEDOUT' &&
            err.url &&
            !err.url.startsWith('https://registry.npmjs.org')
          ) {
            logger.info(
              { depName: name, url: err.url },
              'Cannot connect to private npm host - skipping lookup'
            );
            return 0;
          }
          if (err.statusCode === 429) {
            const retryAfter = err.headers['retry-after'] || 30;
            logger.info(
              `npm too many requests. retrying after ${retryAfter} seconds`
            );
            return delayUnit * (retryAfter + 1);
          }
          if (err.statusCode === 408) {
            logger.info({ err }, 'npm registry failure: timeout, retrying');
            return defaultDelay;
          }
          if (err.statusCode >= 500 && err.statusCode < 600) {
            logger.info(
              { err },
              'npm registry failure: internal error, retrying'
            );
            return defaultDelay;
          }
          return 0;
        },
      },
      headers,
    });
    const res = raw.body;
    // eslint-disable-next-line no-underscore-dangle
    const returnedName = res.name ? res.name : res._id || '';
    if (returnedName.toLowerCase() !== name.toLowerCase()) {
      logger.warn(
        { lookupName: name, returnedName: res.name, regUrl },
        'Returned name does not match with requested name'
      );
      return null;
    }
    if (!res.versions || !Object.keys(res.versions).length) {
      // Registry returned a 200 OK but with no versions
      if (retries <= 0) {
        logger.info({ dependency: name }, 'No versions returned');
        return null;
      }
      logger.info('No versions returned, retrying');
      await delay(5000 / retries);
      return getDependency(name, 0);
    }

    const latestVersion = res.versions[res['dist-tags'].latest];
    res.repository = res.repository || latestVersion.repository;
    res.homepage = res.homepage || latestVersion.homepage;

    // Determine repository URL
    let sourceUrl;

    if (res.repository && res.repository.url) {
      const extraBaseUrls = [];
      // istanbul ignore next
      hostRules.hosts({ platform: 'github' }).forEach(host => {
        extraBaseUrls.push(host, `gist.${host}`);
      });
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
      sourceUrl = parse(res.repository.url, {
        extraBaseUrls,
      });
    }
    if (res.homepage && res.homepage.includes('://github.com')) {
      delete res.homepage;
    }
    // Simplify response before caching and returning
    const dep = {
      name: res.name,
      homepage: res.homepage,
      latestVersion: res['dist-tags'].latest,
      sourceUrl,
      versions: {},
      'dist-tags': res['dist-tags'],
      'renovate-config': latestVersion['renovate-config'],
    };
    if (latestVersion.deprecated) {
      dep.deprecationMessage = `On registry \`${regUrl}\`, the "latest" version (v${
        dep.latestVersion
      }) of dependency \`${name}\` has the following deprecation notice:\n\n\`${
        latestVersion.deprecated
      }\`\n\nMarking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.`;
      dep.deprecationSource = 'npm';
    }
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
      if (res.versions[version].deprecated) {
        release.isDeprecated = true;
      }
      return release;
    });
    logger.trace({ dep }, 'dep');
    // serialize first before saving
    memcache[name] = JSON.stringify(dep);
    const cacheMinutes = process.env.RENOVATE_CACHE_NPM_MINUTES
      ? parseInt(process.env.RENOVATE_CACHE_NPM_MINUTES, 10)
      : 5;
    if (!name.startsWith('@')) {
      await renovateCache.set(cacheNamespace, name, dep, cacheMinutes);
    }
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
          depName: name,
        },
        `Dependency lookup failure: unauthorized`
      );
      return null;
    }
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ depName: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
        token: authInfo ? maskToken(authInfo.token) : 'none',
      });
      return null;
    }
    if (err.name === 'ParseError') {
      // Registry returned a 200 OK but got failed to parse it
      logger.info({ err }, 'npm registry failure: ParseError, retrying');
      await delay(5000 / retries);
      return getDependency(name, retries - 1);
    }
    logger.warn({ err, depName: name }, 'npm registry failure');
    throw new Error('registry-failure');
  }
}
