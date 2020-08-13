import pAll from 'p-all';
import * as semver from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { Release, ReleaseResult } from '../common';

import { id } from './common';

const http = new Http(id);

// https://api.nuget.org/v3/index.json is a default official nuget feed
const defaultNugetFeed = 'https://api.nuget.org/v3/index.json';
const cacheNamespace = 'datasource-nuget';

export function getDefaultFeed(): string {
  return defaultNugetFeed;
}

interface ServicesIndexRaw {
  resources: {
    '@id': string;
    '@type': string;
  }[];
}

export async function getResourceUrl(
  url: string,
  resourceType = 'RegistrationsBaseUrl'
): Promise<string | null> {
  // https://docs.microsoft.com/en-us/nuget/api/service-index
  const cacheKey = `${url}:${resourceType}`;
  const cachedResult = await packageCache.get<string>(cacheNamespace, cacheKey);

  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const servicesIndexRaw = await http.getJson<ServicesIndexRaw>(url);
    const services = servicesIndexRaw.body.resources
      .map(({ '@id': id, '@type': t }) => ({
        id,
        type: t?.split('/')?.shift(),
        version: t?.split('/')?.pop(),
      }))
      .filter(
        ({ type, version }) => type === resourceType && semver.valid(version)
      )
      .sort((x, y) => semver.compare(x.version, y.version));
    const latestAvailableService = services.pop();
    const serviceId = latestAvailableService.id;
    const cacheMinutes = 60;
    await packageCache.set(cacheNamespace, cacheKey, serviceId, cacheMinutes);
    return serviceId;
  } catch (e) {
    logger.debug(
      { e },
      `nuget registry failure: can't get ${resourceType} form ${url}`
    );
    return null;
  }
}

interface CatalogEntry {
  version: string;
  published?: string;
  projectUrl?: string;
}

interface CatalogPage {
  '@id': string;
  items: {
    catalogEntry: CatalogEntry;
  }[];
}

interface PackageRegistration {
  items: CatalogPage[];
}

async function getCatalogEntry(
  catalogPage: CatalogPage
): Promise<CatalogEntry[]> {
  let items = catalogPage.items;
  if (!items) {
    const url = catalogPage['@id'];
    const catalogPageFull = await http.getJson<CatalogPage>(url);
    items = catalogPageFull.body.items;
  }
  return items.map(({ catalogEntry }) => catalogEntry);
}

export async function getReleases(
  registryUrl: string,
  feedUrl: string,
  pkgName: string
): Promise<ReleaseResult | null> {
  const url = `${feedUrl.replace(/\/*$/, '')}/${pkgName}/index.json`;
  const packageRegistration = await http.getJson<PackageRegistration>(url);
  const catalogPages = packageRegistration.body.items || [];
  const catalogPagesQueue = catalogPages.map((page) => (): Promise<
    CatalogEntry[]
  > => getCatalogEntry(page));
  const catalogEntries = (
    await pAll(catalogPagesQueue, { concurrency: 5 })
  ).flat();

  let homepage = null;
  let latestStable = null;
  const releases = catalogEntries.map(
    ({ version, published: releaseTimestamp, projectUrl }) => {
      const release: Release = { version };
      if (releaseTimestamp) {
        release.releaseTimestamp = releaseTimestamp;
      }
      if (semver.valid(version) && !semver.prerelease(version)) {
        latestStable = version;
        homepage = projectUrl || homepage;
      }
      return release;
    }
  );

  if (!releases.length) {
    return null;
  }

  const dep: ReleaseResult = {
    pkgName,
    releases,
  };

  if (registryUrl.toLowerCase() === defaultNugetFeed.toLowerCase()) {
    try {
      const nuspecUrl = `https://api.nuget.org/v3-flatcontainer/${pkgName.toLowerCase()}/${latestStable}/${pkgName.toLowerCase()}.nuspec`;
      const metaresult = await http.get(nuspecUrl);
      const nuspec = new XmlDocument(metaresult.body);
      const sourceUrl = nuspec.valueWithPath('metadata.repository@url');
      if (sourceUrl) {
        dep.sourceUrl = sourceUrl;
      }
    } catch (err) /* istanbul ignore next */ {
      logger.debug(
        `Cannot obtain sourceUrl for ${pkgName} using version ${latestStable}`
      );
      return dep;
    }
  } else if (homepage) {
    dep.sourceUrl = homepage;
  }

  if (homepage) {
    dep.homepage = homepage;
  }

  return dep;
}
