const parse = require('github-url-from-git');
const { XmlDocument } = require('xmldoc');
const get = require('./get');

module.exports = {
  getQueryUrl,
  getPkgReleases,
  getDefaultFeed,
};

// https://api.nuget.org/v3/index.json is a default official nuget feed
const defaultNugetFeed = 'https://api.nuget.org/v3/index.json';

function getDefaultFeed() {
  return defaultNugetFeed;
}

async function getQueryUrl(url) {
  // https://docs.microsoft.com/en-us/nuget/api/search-query-service-resource
  try {
    const servicesIndexRaw = await get(url, {
      retry: 5,
      json: true,
    });
    if (servicesIndexRaw.statusCode !== 200) {
      logger.debug(
        { dependency: url, servicesIndexRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }
    const searchQueryService = servicesIndexRaw.body.resources.find(
      resource => resource['@type'] === 'SearchQueryService'
    );
    return searchQueryService['@id'];
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
    const pkgUrlListRaw = await get(queryUrl, {
      retry: 5,
      json: true,
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
        const result = await get(nugetOrgApi);
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
