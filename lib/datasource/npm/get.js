const moment = require('moment');
const url = require('url');
const getRegistryUrl = require('registry-auth-token/registry-url');
const registryAuthToken = require('registry-auth-token');
const parse = require('github-url-from-git');
const { isBase64 } = require('validator');
const { logger } = require('../../logger');

const got = require('../../util/got');
const hostRules = require('../../util/host-rules');
const { maskToken } = require('../../util/mask');
const { getNpmrc } = require('./npmrc');

module.exports = {
  getDependency,
  resetCache,
  resetMemCache,
};

let memcache = {};

function resetMemCache() {
  logger.debug('resetMemCache()');
  memcache = {};
}

function resetCache() {
  resetMemCache();
}

async function getDependency(name) {
  logger.trace(`npm.getDependency(${name})`);

  // This is our datastore cache and is cleared at the end of each repo, i.e. we never requery/revalidate during a "run"
  if (memcache[name]) {
    logger.trace('Returning cached result');
    return JSON.parse(memcache[name]);
  }

  const scope = name.split('/')[0];
  let regUrl;
  const npmrc = getNpmrc();
  try {
    regUrl = getRegistryUrl(scope, npmrc);
  } catch (err) {
    regUrl = 'https://registry.npmjs.org';
  }
  const pkgUrl = url.resolve(
    regUrl,
    encodeURIComponent(name).replace(/^%40/, '@')
  );
  // Now check the persistent cache
  const cacheNamespace = 'datasource-npm';
  const cachedResult = await renovateCache.get(cacheNamespace, pkgUrl);
  if (cachedResult) {
    return cachedResult;
  }
  const authInfo = registryAuthToken(regUrl, { npmrc });
  const headers = {};

  if (authInfo && authInfo.type && authInfo.token) {
    // istanbul ignore if
    if (npmrc && npmrc.massagedAuth && isBase64(authInfo.token)) {
      logger.debug('Massaging authorization type to Basic');
      authInfo.type = 'Basic';
    }
    headers.authorization = `${authInfo.type} ${authInfo.token}`;
    logger.trace(
      { token: maskToken(authInfo.token), npmName: name },
      'Using auth for npm lookup'
    );
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
      json: true,
      retry: {
        errorCodes: [
          'ECONNRESET',
          'ETIMEDOUT',
          'ECONNRESET',
          'EADDRINUSE',
          'ECONNREFUSED',
          'EPIPE',
          'ENOTFOUND',
          'ENETUNREACH',
          'EAI_AGAIN',
        ],
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
      logger.info({ dependency: name }, 'No versions returned');
      return null;
    }

    const latestVersion = res.versions[res['dist-tags'].latest];
    res.repository = res.repository || latestVersion.repository;
    res.homepage = res.homepage || latestVersion.homepage;

    // Determine repository URL
    let sourceUrl;

    if (res.repository && res.repository.url) {
      const extraBaseUrls = [];
      // istanbul ignore next
      hostRules.hosts({ hostType: 'github' }).forEach(host => {
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
      if (res.repository.url.startsWith('git:github.com/')) {
        res.repository.url = 'https://' + res.repository.url.substr(4);
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
    if (res.repository && res.repository.directory) {
      dep.sourceDirectory = res.repository.directory;
    }
    if (latestVersion.deprecated) {
      dep.deprecationMessage = `On registry \`${regUrl}\`, the "latest" version (v${dep.latestVersion}) of dependency \`${name}\` has the following deprecation notice:\n\n\`${latestVersion.deprecated}\`\n\nMarking the latest version of an npm package as deprecated results in the entire package being considered deprecated, so contact the package author you think this is a mistake.`;
      dep.deprecationSource = 'npm';
    }
    dep.releases = Object.keys(res.versions).map(version => {
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
      await renovateCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
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
    // istanbul ignore if
    if (err.statusCode === 402) {
      logger.info(
        {
          pkgUrl,
          authInfoType: authInfo ? authInfo.type : undefined,
          authInfoToken: authInfo ? maskToken(authInfo.token) : undefined,
          err,
          statusCode: err.statusCode,
          depName: name,
        },
        `Dependency lookup failure: payent required`
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
    if (regUrl.startsWith('https://registry.npmjs.org')) {
      logger.warn({ err, regUrl, depName: name }, 'npm registry failure');
      throw new Error('registry-failure');
    }
    // istanbul ignore next
    return null;
  }
}
