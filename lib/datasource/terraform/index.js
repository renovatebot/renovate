const got = require('got');
const parse = require('github-url-from-git');
const is = require('@sindresorhus/is');

module.exports = {
  getPkgReleases,
};

function getRegistryRepository(lookupName, registryUrls) {
  let registry;
  const split = lookupName.split('/');
  if (split.length > 3 && split[0].includes('.')) {
    [registry] = split;
    split.shift();
  } else if (is.nonEmptyArray(registryUrls)) {
    [registry] = registryUrls;
  } else {
    registry = 'registry.terraform.io';
  }
  if (!registry.match('^https?://')) {
    registry = `https://${registry}`;
  }
  const repository = split.join('/');
  return {
    registry,
    repository,
  };
}

/*
 * terraform.getPkgReleases
 *
 * This function will fetch a package from the specified Terraform registry and return all semver versions.
 *  - `sourceUrl` is supported of "source" field is set
 *  - `homepage` is set to the Terraform registry's page if it's on the official main registry
 */

async function getPkgReleases({ lookupName, registryUrls }) {
  const { registry, repository } = getRegistryRepository(
    lookupName,
    registryUrls
  );
  logger.debug({ registry, repository }, 'terraform.getDependencies()');
  const cacheNamespace = 'terraform';
  const pkgUrl = `${registry}/v1/modules/${repository}`;
  const cachedResult = await renovateCache.get(cacheNamespace, pkgUrl);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const res = (await got(pkgUrl, {
      json: true,
      retry: 5,
    })).body;
    const returnedName = res.namespace + '/' + res.name + '/' + res.provider;
    if (returnedName !== repository) {
      logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
      return null;
    }
    // Simplify response before caching and returning
    const dep = {
      name: repository,
      versions: {},
    };
    if (res.source) {
      dep.sourceUrl = parse(res.source);
    }
    dep.releases = res.versions.map(version => ({
      version,
    }));
    if (pkgUrl.startsWith('https://registry.terraform.io/')) {
      dep.homepage = `https://registry.terraform.io/modules/${repository}`;
    }
    logger.trace({ dep }, 'dep');
    const cacheMinutes = 30;
    await renovateCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info(
        { lookupName },
        `Terraform registry lookup failure: not found`
      );
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn(
      { err, lookupName },
      'Terraform registry failure: Unknown error'
    );
    return null;
  }
}
