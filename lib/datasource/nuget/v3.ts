import * as semver from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import got from '../../util/got';
import { ReleaseResult } from '../common';

// https://api.nuget.org/v3/index.json is a default official nuget feed
const defaultNugetFeed = 'https://api.nuget.org/v3/index.json';
const cacheNamespace = 'datasource-nuget';

export function getDefaultFeed(): string {
  return defaultNugetFeed;
}

export async function getQueryUrl(url: string): Promise<string | null> {
  // https://docs.microsoft.com/en-us/nuget/api/search-query-service-resource
  const resourceType = 'SearchQueryService';
  const cacheKey = `${url}:${resourceType}`;
  const cachedResult = await renovateCache.get<string>(
    cacheNamespace,
    cacheKey
  );

  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const servicesIndexRaw = await got(url, { json: true, hostType: 'nuget' });
    if (servicesIndexRaw.statusCode !== 200) {
      logger.debug(
        { dependency: url, servicesIndexRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }
    const searchQueryService = servicesIndexRaw.body.resources.find(
      resource =>
        resource['@type'] && resource['@type'].startsWith(resourceType)
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

export async function getPkgReleases(
  registryUrl: string,
  feedUrl: string,
  pkgName: string
): Promise<ReleaseResult | null> {
  let queryUrl = `${feedUrl}?q=${pkgName}`;
  if (registryUrl.toLowerCase() === defaultNugetFeed.toLowerCase()) {
    queryUrl = queryUrl.replace('q=', 'q=PackageId:');
    queryUrl += '&semVerLevel=2.0.0&prerelease=true';
  }
  const dep: ReleaseResult = {
    pkgName,
    releases: [],
  };
  try {
    const pkgUrlListRaw = await got(queryUrl, {
      json: true,
      hostType: 'nuget',
    });
    if (pkgUrlListRaw.statusCode !== 200) {
      logger.debug(
        { dependency: pkgName, pkgUrlListRaw },
        `nuget registry failure: status code != 200`
      );
      return null;
    }

    const match = pkgUrlListRaw.body.data.find(
      item => item.id.toLowerCase() === pkgName.toLowerCase()
    );
    // https://docs.microsoft.com/en-us/nuget/api/search-query-service-resource#search-result
    if (!match) {
      // There are no pkgName or releases in current feed
      return null;
    }
    dep.releases = match.versions.map(item => ({
      version: item.version,
    }));

    try {
      // For nuget.org we have a way to get nuspec file
      const sanitizedVersions = dep.releases
        .map(release => semver.valid(release.version))
        .filter(Boolean)
        .filter(version => !semver.prerelease(version));
      let lastVersion: string;
      // istanbul ignore else
      if (sanitizedVersions.length) {
        // Use the last stable version we found
        lastVersion = sanitizedVersions.pop();
      } else {
        // Just use the last one from the list and hope for the best
        lastVersion = [...dep.releases].pop().version;
      }
      if (registryUrl.toLowerCase() === defaultNugetFeed.toLowerCase()) {
        const nugetOrgApi = `https://api.nuget.org/v3-flatcontainer/${pkgName.toLowerCase()}/${lastVersion}/${pkgName.toLowerCase()}.nuspec`;
        let metaresult: { body: string };
        try {
          metaresult = await got(nugetOrgApi, { hostType: 'nuget' });
        } catch (err) /* istanbul ignore next */ {
          logger.debug(
            `Cannot fetch metadata for ${pkgName} using popped version ${lastVersion}`
          );
          return dep;
        }
        const nuspec = new XmlDocument(metaresult.body);
        const sourceUrl = nuspec.valueWithPath('metadata.repository@url');
        if (sourceUrl) {
          dep.sourceUrl = sourceUrl;
        }
      } else if (match.projectUrl) {
        dep.sourceUrl = match.projectUrl;
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
