const got = require('got');
const parse = require('github-url-from-git');
const { isVersion, sortVersions } = require('../../versioning/semver');

module.exports = {
  getPkgReleases,
};

/*
 * terraform.getPkgReleases
 *
 * This function will fetch a package from the specified Terraform registry and return all semver versions.
 *  - `sourceUrl` is supported of "source" field is set
 *  - `homepage` is set to the Terraform registry's page if it's on the official main registry
 */

async function getPkgReleases(purl) {
  const { fullname: dependency, qualifiers } = purl;
  const registry = qualifiers.registry || 'registry.terraform.io';
  logger.debug({ dependency, registry }, 'terraform.getDependencies()');
  const pkgUrl = `https://${registry}/v1/modules/${dependency}`;
  try {
    const res = (await got(pkgUrl, {
      json: true,
      retry: 5,
    })).body;
    const returnedName = res.namespace + '/' + res.name + '/' + res.provider;
    if (returnedName !== dependency) {
      logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
      return null;
    }
    // Simplify response before caching and returning
    const dep = {
      name: dependency,
      versions: {},
    };
    if (res.source) {
      dep.sourceUrl = parse(res.source);
    }
    dep.releases = res.versions
      .filter(v => isVersion(v))
      .sort(sortVersions)
      .map(version => ({
        version,
      }));
    if (pkgUrl.startsWith('https://registry.terraform.io/')) {
      dep.homepage = `https://registry.terraform.io/modules/${dependency}`;
    }
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info(
        { dependency },
        `Terraform registry lookup failure: not found`
      );
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn(
      { err, dependency },
      'Terraform registry failure: Unknown error'
    );
    return null;
  }
}
