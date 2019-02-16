const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

/*
 * orb.getPkgReleases
 *
 * This function will fetch an orb from CircleCI and return all semver versions.
 */

async function getPkgReleases({ lookupName }) {
  logger.debug({ lookupName }, 'orb.getPkgReleases()');
  const cacheNamespace = 'orb';
  const cacheKey = lookupName;
  const cachedResult = await renovateCache.get(cacheNamespace, cacheKey);
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const url = 'https://circleci.com/graphql-unstable';
  const body = {
    query: `{orb(name:"${lookupName}"){name, homeUrl, versions {version, createdAt}}}`,
    variables: {},
  };
  try {
    const res = (await got.post(url, {
      body,
      json: true,
      retry: 5,
    })).body.data.orb;
    // Simplify response before caching and returning
    const dep = {
      name: lookupName,
      versions: {},
    };
    if (res.homeUrl && res.homeUrl.length) {
      dep.homepage = res.homeUrl;
    }
    dep.homepage =
      dep.homepage || `https://circleci.com/orbs/registry/orb/${lookupName}`;
    dep.releases = res.versions.map(v => v.version);
    dep.releases = dep.releases.map(version => ({
      version,
    }));
    logger.trace({ dep }, 'dep');
    const cacheMinutes = 30;
    await renovateCache.set(cacheNamespace, cacheKey, dep, cacheMinutes);
    return dep;
  } catch (err) /* istanbul ignore next */ {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.info({ lookupName }, `CircleCI Orb lookup failure: not found`);
      logger.debug({
        err,
      });
      return null;
    }
    logger.warn(
      { err, lookupName },
      'CircleCI Orb lookup failure: Unknown error'
    );
    return null;
  }
}
