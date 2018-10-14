const URL = require('url');
const got = require('got');
const parse = require('github-url-from-git');
const { isVersion, sortVersions } = require('../versioning')('semverComposer');

module.exports = {
  getPkgReleases,
};

async function getRegistryMeta(regUrl) {
  try {
    const res = (await got(regUrl + '/packages.json', {
      json: true,
      retries: 5,
    })).body;
    // TODO: Check for res.packages length as per https://getcomposer.org/doc/05-repositories.md#packages
    const providersUrl = res['providers-url'];
    const files = [];
    for (const [key, val] of Object.entries(res['provider-includes'])) {
      const file = {
        key,
        sha256: val.sha256,
      };
      files.push(file);
    }
    return {
      providersUrl,
      files,
    };
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
  const res = (await got(regUrl + '/' + fileName, {
    json: true,
    retries: 5,
  })).body;
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
  const { providersUrl, files } = registryMeta;
  const packages = {};
  // TODO: refactor the following to be in parallel
  for (const file of files) {
    const res = await getPackagistFile(regUrl, file);
    for (const [name, val] of Object.entries(res.providers)) {
      packages[name] = val.sha256;
    }
  }
  return { providersUrl, packages };
}

async function packageLookup(regUrl, name) {
  try {
    const packages = await getAllPackages(regUrl);
    if (!packages.packages[name]) {
      return null;
    }
    const pkgUrl = URL.resolve(
      regUrl,
      packages.providersUrl
        .replace('%package%', name)
        .replace('%hash%', packages.packages[name])
    );
    const versions = (await got(pkgUrl, {
      json: true,
      retries: 5,
    })).body.packages[name];

    // Simplify response before caching and returning
    const dep = {
      name,
      versions: {},
    };

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
      } else {
        logger.info({ regUrl }, 'Unsupported Packagist registry URL');
      }
    }
  }
  regUrls.push('https://packagist.org');
  if (regUrls.length > 1) {
    logger.debug({ regUrls }, 'Packagist registry URLs');
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
