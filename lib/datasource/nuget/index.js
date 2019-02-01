const parse = require('github-url-from-git');
const { XmlDocument } = require('xmldoc');

const got = require('../../util/got');

module.exports = {
  getPkgReleases,
};

async function getPkgReleases(purl, config) {
  const { lookupName: pkgName } = purl;
  logger.trace(`nuget.getPkgReleases(${pkgName})`);
  let dep = null;
  for (const feed of config.nugetFeeds) {
    if (dep != null) break;
    if (feed.version === 3) {
      dep = await getPkgReleasesFromV3Feed(feed.url, pkgName);
    } else if (feed.version === 2) {
      dep = await getPkgReleasesFromV2Feed(feed.url, pkgName);
    }
  }
  if (dep != null) {
    return dep;
  }

  logger.info(
    { dependency: pkgName },
    `Dependency lookup failure: not found in all feeds`
  );
  return null;
}

async function getPkgReleasesFromV3Feed(feedUrl, pkgName) {
  const pkgUrl = `${feedUrl}/v3-flatcontainer/${pkgName.toLowerCase()}/index.json`;
  try {
    const res = (await got(pkgUrl, {
      json: true,
      retry: 5,
    })).body;
    const dep = {
      pkgName,
    };
    dep.releases = (res.versions || []).map(version => ({ version }));
    // look up nuspec for latest release to get repository
    const url = `${feedUrl}/v3-flatcontainer/${pkgName.toLowerCase()}/${res.versions.pop()}/${pkgName.toLowerCase()}.nuspec`;
    try {
      const result = await got(url);
      const nuspec = new XmlDocument(result.body);
      if (nuspec) {
        const sourceUrl = parse(
          nuspec.valueWithPath('metadata.repository@url')
        );
        if (sourceUrl) {
          dep.sourceUrl = sourceUrl;
        }
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug({ dependency: pkgName, feedUrl }, 'Error looking up nuspec');
    }
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug(
        { dependency: pkgName, feedUrl },
        `Dependency lookup failure: not found`
      );
      logger.debug({
        err,
      });
      return null;
    }
    logger.debug(
      { err, pkgName, feedUrl },
      'nuget registry failure: Unknown error'
    );
    return null;
  }
}

async function getPkgReleasesFromV2Feed(feedUrl, pkgName) {
  const pkgUrlList = `${feedUrl}/FindPackagesById()?id=%27${pkgName}%27&$orderby=LastUpdated%20desc&$select=Version&$format=json`;
  const pkgUrl = `${feedUrl}/FindPackagesById()?id=%27${pkgName}%27&$orderby=LastUpdated%20desc&$format=json&$top=1`;
  const dep = {
    pkgName,
  };
  try {
    const pkgVersionsListRaw = await got(pkgUrlList, { retry: 5, json: true });
    const pkgLatestRaw = await got(pkgUrl, { retry: 5, json: true });
    if (pkgVersionsListRaw.statusCode !== 200) {
      logger.debug(
        { dependency: pkgName, pkgVersionsListRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }
    if (pkgLatestRaw.statusCode !== 200) {
      logger.debug(
        { dependency: pkgName, pkgVersionsListRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }

    dep.releases = (pkgVersionsListRaw.body.d.results || []).map(result => ({
      version: result.Version,
    }));
    dep.sourceUrl = pkgLatestRaw.body.d.results[0].ProjectUrl;

    return dep;
  } catch (err) {
    logger.debug(
      { err, pkgName, feedUrl },
      'nuget registry failure: Unknown error'
    );
    return null;
  }
}
