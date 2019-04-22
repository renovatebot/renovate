const parse = require('github-url-from-git');
const { XmlDocument } = require('xmldoc');
const got = require('../../util/got');

module.exports = {
  getQueryUrl,
  getPkgReleases,
  getDefaultFeed,
};

// https://api.nuget.org/v3/index.json is a default official nuget feed
const defaultNugetFeed = 'https://api.nuget.org/v3/index.json';
const cacheNamespace = 'datasource-nuget';

function getDefaultFeed() {
  return defaultNugetFeed;
}

async function getQueryUrl(url) {
  // https://docs.microsoft.com/en-us/nuget/api/search-query-service-resource
  const resourceType = 'SearchQueryService';
  const cacheKey = `${url}:${resourceType}`;
  const cachedResult = await renovateCache.get(cacheNamespace, cacheKey);

  if (cachedResult) {
    return cachedResult;
  }

  try {
    const servicesIndexRaw = await got(url, { json: true, platform: 'nuget' });
    if (servicesIndexRaw.statusCode !== 200) {
      logger.debug(
        { dependency: url, servicesIndexRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }
    const searchQueryService = servicesIndexRaw.body.resources.find(
      resource => resource['@type'] === resourceType
    );
    const searchQueryServiceId = searchQueryService['@id'];

    const cacheMinutes = 60;
    await renovateCache.set(
      cacheNamespace,
      cacheKey,
      searchQueryServiceId,
      cacheMinutes
    );
    return searchQueryServiceId;
  } catch (e) {
    logger.debug(
      { e },
      `nuget registry failure: can't get SearchQueryService form ${url}`
    );
    return null;
  }
}

async function getPkgReleases(registryUrl, feedUrl, pkgName) {
  const queryUrl = `${feedUrl}?q=PackageId:${pkgName}`;
  const dep = {
    pkgName,
  };
  try {
    const pkgUrlListRaw = await got(queryUrl, {
      json: true,
      platform: 'nuget',
    });
    if (pkgUrlListRaw.statusCode !== 200) {
      logger.debug(
        { dependency: pkgName, pkgUrlListRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }

    // There are no pkgName is current feed
    if (pkgUrlListRaw.body.totalHits === 0) {
      return null;
    }

    dep.releases = (pkgUrlListRaw.body.data[0].versions || []).map(item => ({
      version: item.version,
    }));

    try {
      // For nuget.org we have a way to get nuspec file
      if (registryUrl.toLowerCase() === defaultNugetFeed.toLowerCase()) {
        const nugetOrgApi = `https://api.nuget.org/v3-flatcontainer/${pkgName.toLowerCase()}/${
          [...dep.releases].pop().version
        }/${pkgName.toLowerCase()}.nuspec`;
        const result = await got(nugetOrgApi, { platform: 'nuget' });
        const nuspec = new XmlDocument(result.body);
        if (nuspec) {
          const sourceUrl = parse(
            nuspec.valueWithPath('metadata.repository@url')
          );
          if (sourceUrl) {
            dep.sourceUrl = sourceUrl;
          }
        }
      } else if (
        Object.prototype.hasOwnProperty.call(
          pkgUrlListRaw.body.data[0],
          'projectUrl'
        )
      ) {
        dep.sourceUrl = parse(pkgUrlListRaw.body.data[0].projectUrl);
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug(
        { err, pkgName, feedUrl },
        `nuget registry failure: can't parse pkg info for project url`
      );
    }

    return dep;
  } catch (err) {
    logger.debug(
      { err, pkgName, feedUrl },
      'nuget registry failure: Unknown error'
    );
    return null;
  }
}
