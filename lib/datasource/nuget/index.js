const parse = require('github-url-from-git');
const { XmlDocument } = require('xmldoc');
const urlApi = require('url');
const got = require('../../util/got');
const hostRules = require('../../util/host-rules');

module.exports = {
  getPkgReleases,
};

const defaultNugetFeed = 'https://api.nuget.org/v3/index.json';

async function getPkgReleases({ lookupName, registryUrls }) {
  logger.trace(`nuget.getPkgReleases(${lookupName})`);
  let dep = null;
  // https://api.nuget.org/v3/index.json is a default official nuget feed
  const feeds = registryUrls === null ? [defaultNugetFeed] : registryUrls;
  for (const feed of feeds) {
    if (dep != null) break;

    const feedVersion = detectFeedVersion(feed);
    if (feedVersion !== null) {
      if (feedVersion === 3) {
        const queryUrl = await getQueryUrlForV3Feed(feed);
        if (queryUrl !== null) {
          dep = await getPkgReleasesFromV3Feed(feed, queryUrl, lookupName);
        }
      } else if (feedVersion === 2) {
        dep = await getPkgReleasesFromV2Feed(feed, lookupName);
      }
    }
  }
  if (dep != null) {
    return dep;
  }

  logger.info(
    { lookupName },
    `Dependency lookup failure: not found in all feeds`
  );
  return null;
}

async function getPkgReleasesFromV3Feed(registryUrl, feedUrl, pkgName) {
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

async function getPkgReleasesFromV2Feed(feedUrl, pkgName) {
  const pkgUrlList = `${feedUrl}/FindPackagesById()?id=%27${pkgName}%27&$select=Version`;
  const pkgUrl = `${feedUrl}/FindPackagesById()?id=%27${pkgName}%27&$top=1`;
  const dep = {
    pkgName,
  };
  try {
    const pkgVersionsListRaw = await get(pkgUrlList, { retry: 5 });
    const pkgLatestRaw = await get(pkgUrl, { retry: 5 });
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
    const pkgInfoList = new XmlDocument(
      pkgVersionsListRaw.body
    ).children.filter(node => node.name === 'entry');

    dep.releases = (pkgInfoList || [])
      .map(info => info.children.find(child => child.name === 'm:properties'))
      .map(item => ({
        version: item.children.find(child => child.name === 'd:Version').val,
      }));

    try {
      const pkgInfo = new XmlDocument(pkgLatestRaw.body).children.filter(
        node => node.name === 'entry'
      )[0];
      dep.sourceUrl = parse(
        pkgInfo.children
          .filter(child => child.name === 'm:properties')[0]
          .children.filter(child => child.name === 'd:ProjectUrl')[0].val
      );
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

function detectFeedVersion(url) {
  try {
    const parsecUrl = urlApi.parse(url);
    // Official client does it in the same way
    if (parsecUrl.pathname.endsWith('.json')) {
      return 3;
    }
    return 2;
  } catch (e) {
    logger.debug({ e }, `nuget registry failure: can't parse ${url}`);
    return null;
  }
}

async function getQueryUrlForV3Feed(url) {
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

function get(url, options) {
  const finalOptions = options || {};
  const { host } = urlApi.parse(url);
  const hostRule = hostRules.find({ platform: 'nuget', host });
  if (hostRule && hostRule.username && hostRule.password) {
    const auth = Buffer.from(
      `${hostRule.username}:${hostRule.password}`
    ).toString('base64');
    finalOptions.headers = finalOptions.headers || {};
    finalOptions.headers.Authorization = `Basic ${auth}`;
    logger.debug(
      { url },
      `Setting basic auth header as configured via host rule`
    );
  }
  return got(url, finalOptions);
}
