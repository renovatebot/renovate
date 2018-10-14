const is = require('@sindresorhus/is');
const URL = require('url');
const got = require('got');
const parse = require('github-url-from-git');
const { isVersion, sortVersions } = require('../versioning')('semverComposer');
const hostRules = require('../util/host-rules');

module.exports = {
  getPkgReleases,
};

function authGot(url) {
  const { host } = URL.parse(url);
  const opts = hostRules.find({ platform: 'composer', host }, { json: true });
  if (opts && opts.username && opts.password) {
    const auth = Buffer.from(`${opts.username}:${opts.password}`).toString(
      'base64'
    );
    opts.headers = { Authorization: `Basic ${auth}` };
  }
  return got(url, opts);
}

async function getRegistryMeta(regUrl) {
  try {
    const res = (await authGot(regUrl + '/packages.json')).body;
    const meta = {};
    meta.packages = res.packages;
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
    logger.warn({ err }, 'Packagist download error');
    return null;
  }
}

async function getPackagistFile(regUrl, file) {
  const { key, sha256 } = file;
  // Check the persistent cache
  const cacheNamespace = 'datasource-packagist-files';
  const cachedResult = await renovateCache.get(cacheNamespace, key);
  if (cachedResult && cachedResult.sha256 === sha256) {
    return cachedResult.res;
  }
  const fileName = key.replace('%hash%', sha256);
  const res = (await authGot(regUrl + '/' + fileName)).body;
  const cacheMinutes = 1440; // 1 day
  await renovateCache.set(
    cacheNamespace,
    file.key,
    { res, sha256 },
    cacheMinutes
  );
  return res;
}

async function getAllPackages(regUrl) {
  // TODO: Cache this in memory per-run as it's likely to be reused
  const registryMeta = await getRegistryMeta(regUrl);
  const { packages, providersUrl, files } = registryMeta;
  const providerPackages = {};
  // TODO: refactor the following to be in parallel
  for (const file of files) {
    const res = await getPackagistFile(regUrl, file);
    for (const [name, val] of Object.entries(res.providers)) {
      providerPackages[name] = val.sha256;
    }
  }
  return { packages, providersUrl, providerPackages };
}

function extractDepReleases(versions) {
  const dep = {};
  dep.releases = Object.keys(versions)
    .filter(isVersion)
    .sort(sortVersions)
    .map(version => {
      const release = versions[version];
      dep.homepage = release.homepage || dep.homepage;
      if (release.source && release.source.url) {
        dep.repositoryUrl = parse(release.source.url) || release.source.url;
      }
      return {
        version: version.replace(/^v/, ''),
        gitRef: version,
        releaseTimestamp: release.time,
      };
    });
  return dep;
}

async function packageLookup(regUrl, name) {
  try {
    const { packages, providersUrl, providerPackages } = await getAllPackages(
      regUrl
    );
    if (packages && packages[name]) {
      const dep = extractDepReleases(versions);
      dep.name = name;
      return dep;
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
    const versions = (await authGot(pkgUrl)).body.packages[name];
    const dep = extractDepReleases(versions);
    dep.name = name;
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) {
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
  logger.trace(`getPkgReleases(${name})`);
  const regUrls = [];
  if (config.registryUrls) {
    for (const regUrl of config.registryUrls) {
      if (regUrl.type === 'composer') {
        regUrls.push(regUrl.url);
      } else if (regUrl['packagist.org'] !== false) {
        logger.info({ regUrl }, 'Unsupported Packagist registry URL');
      }
    }
  }
  if (regUrls.length > 0) {
    logger.debug({ regUrls }, 'Packagist custom registry URLs');
  }
  if (
    !is.nonEmptyArray(config.registryUrls) ||
    config.registryUrls[config.registryUrls.length - 1]['packagist.org'] !==
      false
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
