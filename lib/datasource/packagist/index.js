const is = require('@sindresorhus/is');
const URL = require('url');
const delay = require('delay');
const got = require('got');
const parse = require('github-url-from-git');
const pAll = require('p-all');
const hostRules = require('../../util/host-rules');

module.exports = {
  getPkgReleases,
};

function getHostOpts(url) {
  const { host } = URL.parse(url);
  const opts = hostRules.find({ platform: 'packagist', host }, { json: true });
  if (opts && opts.username && opts.password) {
    const auth = Buffer.from(`${opts.username}:${opts.password}`).toString(
      'base64'
    );
    opts.headers = { Authorization: `Basic ${auth}` };
  }
  return opts;
}

async function getRegistryMeta(regUrl) {
  try {
    const url = URL.resolve(regUrl.replace(/\/?$/, '/'), 'packages.json');
    const opts = getHostOpts(url);
    const res = (await got(url, opts)).body;
    const meta = {};
    meta.packages = res.packages;
    if (res.includes) {
      meta.includesFiles = [];
      for (const [name, val] of Object.entries(res.includes)) {
        const file = {
          key: name.replace(val.sha256, '%hash%'),
          sha256: val.sha256,
        };
        meta.includesFiles.push(file);
      }
    }
    if (res['providers-url'] && res['provider-includes']) {
      meta.providersUrl = res['providers-url'];
      meta.files = [];
      for (const [key, val] of Object.entries(res['provider-includes'])) {
        const file = {
          key,
          sha256: val.sha256,
        };
        meta.files.push(file);
      }
    }
    return meta;
  } catch (err) {
    if (err.statusCode === 401) {
      logger.info({ regUrl }, 'Unauthorized Packagist repository');
      return null;
    }
    if (
      err.statusCode === 404 &&
      err.url &&
      err.url.endsWith('/packages.json')
    ) {
      logger.info({ regUrl }, 'Packagist repository not found');
      return null;
    }
    logger.warn({ err }, 'Packagist download error');
    return null;
  }
}

async function getPackagistFile(regUrl, file) {
  const { key, sha256 } = file;
  const fileName = key.replace('%hash%', sha256);
  const opts = getHostOpts(regUrl);
  if (opts.headers && opts.headers.Authorization) {
    return (await got(regUrl + '/' + fileName, opts)).body;
  }
  const cacheNamespace = 'datasource-packagist-files';
  const cacheKey = regUrl + key;
  // Check the persistent cache for public registries
  const cachedResult = await renovateCache.get(cacheNamespace, cacheKey);
  // istanbul ignore if
  if (cachedResult && cachedResult.sha256 === sha256) {
    return cachedResult.res;
  }
  const res = (await got(regUrl + '/' + fileName, opts)).body;
  const cacheMinutes = 1440; // 1 day
  await renovateCache.set(
    cacheNamespace,
    cacheKey,
    { res, sha256 },
    cacheMinutes
  );
  return res;
}

function extractDepReleases(versions) {
  const dep = {};
  // istanbul ignore if
  if (!versions) {
    dep.releases = [];
    return dep;
  }
  dep.releases = Object.keys(versions).map(version => {
    const release = versions[version];
    dep.homepage = release.homepage || dep.homepage;
    if (release.source && release.source.url) {
      dep.sourceUrl = parse(release.source.url) || release.source.url;
    }
    return {
      version: version.replace(/^v/, ''),
      gitRef: version,
      releaseTimestamp: release.time,
    };
  });
  return dep;
}

async function getAllPackages(regUrl) {
  let repoCacheResult = global.repoCache[`packagist-${regUrl}`];
  // istanbul ignore if
  if (repoCacheResult) {
    while (repoCacheResult === 'pending') {
      await delay(200);
      repoCacheResult = global.repoCache[`packagist-${regUrl}`];
    }
    return repoCacheResult;
  }
  global.repoCache[`packagist-${regUrl}`] = 'pending';
  const registryMeta = await getRegistryMeta(regUrl);
  if (!registryMeta) {
    global.repoCache[`packagist-${regUrl}`] = null;
    return null;
  }
  const { packages, providersUrl, files, includesFiles } = registryMeta;
  const providerPackages = {};
  if (files) {
    const queue = files.map(file => () => getPackagistFile(regUrl, file));
    const resolvedFiles = await pAll(queue, { concurrency: 5 });
    for (const res of resolvedFiles) {
      for (const [name, val] of Object.entries(res.providers)) {
        providerPackages[name] = val.sha256;
      }
    }
  }
  const includesPackages = {};
  if (includesFiles) {
    for (const file of includesFiles) {
      const res = await getPackagistFile(regUrl, file);
      if (res.packages) {
        for (const [key, val] of Object.entries(res.packages)) {
          const dep = extractDepReleases(val);
          dep.name = key;
          includesPackages[key] = dep;
        }
      }
    }
  }
  const allPackages = {
    packages,
    providersUrl,
    providerPackages,
    includesPackages,
  };
  global.repoCache[`packagist-${regUrl}`] = allPackages;
  return allPackages;
}

async function packagistOrgLookup(name) {
  const cacheNamespace = 'datasource-packagist-org';
  const cachedResult = await renovateCache.get(cacheNamespace, name);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let dep = null;
  const regUrl = 'https://packagist.org';
  const pkgUrl = URL.resolve(regUrl, `/p/${name}.json`);
  const res = (await got(pkgUrl, {
    json: true,
    retry: 5,
  })).body.packages[name];
  if (res) {
    dep = extractDepReleases(res);
    dep.name = name;
    logger.trace({ dep }, 'dep');
  }
  const cacheMinutes = 10;
  await renovateCache.set(cacheNamespace, name, dep, cacheMinutes);
  return dep;
}

async function packageLookup(regUrl, name) {
  try {
    if (regUrl === 'https://packagist.org') {
      const packagistResult = await packagistOrgLookup(name);
      return packagistResult;
    }
    const allPackages = await getAllPackages(regUrl);
    if (!allPackages) {
      return null;
    }
    const {
      packages,
      providersUrl,
      providerPackages,
      includesPackages,
    } = allPackages;
    if (packages && packages[name]) {
      const dep = extractDepReleases(packages[name]);
      dep.name = name;
      return dep;
    }
    if (includesPackages && includesPackages[name]) {
      return includesPackages[name];
    }
    if (!(providerPackages && providerPackages[name])) {
      return null;
    }
    const pkgUrl = URL.resolve(
      regUrl,
      providersUrl
        .replace('%package%', name)
        .replace('%hash%', providerPackages[name])
    );
    const opts = getHostOpts(regUrl);
    const versions = (await got(pkgUrl, opts)).body.packages[name];
    const dep = extractDepReleases(versions);
    dep.name = name;
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ dependency: name }, `Dependency lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn({ err, name }, 'packagist registry failure: Unknown error');
    return null;
  }
}

async function getPkgReleases(purl, config = {}) {
  const { fullname: name } = purl;
  const { registryUrls } = config;
  logger.trace(`getPkgReleases(${name})`);
  const regUrls = [];
  if (registryUrls) {
    for (const regUrl of registryUrls) {
      if (regUrl.type === 'composer') {
        regUrls.push(regUrl.url);
      } else if (regUrl.type === 'package') {
        logger.info({ regUrl }, 'Skipping package repository entry');
      } else if (regUrl['packagist.org'] !== false) {
        logger.info({ regUrl }, 'Unsupported Packagist registry URL');
      }
    }
  }
  if (regUrls.length > 0) {
    logger.debug({ regUrls }, 'Packagist custom registry URLs');
  }
  if (
    !is.nonEmptyArray(registryUrls) ||
    registryUrls[registryUrls.length - 1]['packagist.org'] !== false
  ) {
    regUrls.push('https://packagist.org');
  } else {
    logger.debug('Disabling packagist.org');
  }

  let res;
  for (const regUrl of regUrls) {
    res = await packageLookup(regUrl, name);
    if (res) {
      break;
    }
  }
  return res;
}
