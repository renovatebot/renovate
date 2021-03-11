import is from '@sindresorhus/is';
import { RequestError } from 'got';
import pAll from 'p-all';
import * as semver from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { ensureTrailingSlash } from '../../util/url';
import type { Release, ReleaseResult } from '../types';

import { id, removeBuildMeta } from './common';

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
  const resultCacheKey = `${url}:${resourceType}`;
  const cachedResult = await packageCache.get<string>(
    cacheNamespace,
    resultCacheKey
  );

  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const responseCacheKey = url;
    let servicesIndexRaw = await packageCache.get<ServicesIndexRaw>(
      cacheNamespace,
      responseCacheKey
    );
    // istanbul ignore else: currently not testable
    if (!servicesIndexRaw) {
      servicesIndexRaw = (await http.getJson<ServicesIndexRaw>(url)).body;
      await packageCache.set(
        cacheNamespace,
        responseCacheKey,
        servicesIndexRaw,
        3 * 24 * 60
      );
    }

    const services = servicesIndexRaw.resources
      .map(({ '@id': serviceId, '@type': t }) => ({
        serviceId,
        type: t?.split('/')?.shift(),
        version: t?.split('/')?.pop(),
      }))
      .filter(
        ({ type, version }) => type === resourceType && semver.valid(version)
      )
      .sort((x, y) => semver.compare(x.version, y.version));
    const { serviceId, version } = services.pop();

    // istanbul ignore if
    if (
      resourceType === 'RegistrationsBaseUrl' &&
      !version?.startsWith('3.0.0-') &&
      !semver.satisfies(version, '^3.0.0')
    ) {
      logger.warn(
        { url, version },
        `Nuget: Unknown version returned. Only v3 is supported`
      );
    }

    await packageCache.set(cacheNamespace, resultCacheKey, serviceId, 60);
    return serviceId;
  } catch (err) {
    logger.debug(
      { err, url },
      `nuget registry failure: can't get ${resourceType}`
    );
    return null;
  }
}

interface CatalogEntry {
  version: string;
  published?: string;
  projectUrl?: string;
  listed?: boolean;
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
  const baseUrl = feedUrl.replace(/\/*$/, '');
  const url = `${baseUrl}/${pkgName.toLowerCase()}/index.json`;
  const packageRegistration = await http.getJson<PackageRegistration>(url);
  const catalogPages = packageRegistration.body.items || [];
  const catalogPagesQueue = catalogPages.map((page) => (): Promise<
    CatalogEntry[]
  > => getCatalogEntry(page));
  const catalogEntries = (
    await pAll(catalogPagesQueue, { concurrency: 5 })
  ).flat();

  let homepage = null;
  let latestStable: string = null;
  const releases = catalogEntries.map(
    ({ version, published: releaseTimestamp, projectUrl, listed }) => {
      const release: Release = { version: removeBuildMeta(version) };
      if (releaseTimestamp) {
        release.releaseTimestamp = releaseTimestamp;
      }
      if (semver.valid(version) && !semver.prerelease(version)) {
        latestStable = removeBuildMeta(version);
        homepage = projectUrl || homepage;
      }
      if (listed === false) {
        release.isDeprecated = true;
      }
      return release;
    }
  );

  if (!releases.length) {
    return null;
  }

  // istanbul ignore if: only happens when no stable version exists
  if (latestStable === null) {
    const last = catalogEntries.pop();
    latestStable = removeBuildMeta(last.version);
    homepage ??= last.projectUrl;
  }

  const dep: ReleaseResult = {
    releases,
  };

  try {
    const packageBaseAddress = await getResourceUrl(
      registryUrl,
      'PackageBaseAddress'
    );
    // istanbul ignore else: this is a required v3 api
    if (is.nonEmptyString(packageBaseAddress)) {
      const nuspecUrl = `${ensureTrailingSlash(
        packageBaseAddress
      )}${pkgName.toLowerCase()}/${latestStable}/${pkgName.toLowerCase()}.nuspec`;
      const metaresult = await http.get(nuspecUrl);
      const nuspec = new XmlDocument(metaresult.body);
      const sourceUrl = nuspec.valueWithPath('metadata.repository@url');
      if (sourceUrl) {
        dep.sourceUrl = sourceUrl;
      }
    }
  } catch (err) /* istanbul ignore next */ {
    // ignore / silence 404. Seen on proget, if remote connector is used and package is not yet cached
    if (err instanceof RequestError && err.response?.statusCode === 404) {
      logger.debug(
        { registryUrl, pkgName, pkgVersion: latestStable },
        `package manifest (.nuspec) not found`
      );
      return dep;
    }
    logger.debug(
      { err, registryUrl, pkgName, pkgVersion: latestStable },
      `Cannot obtain sourceUrl`
    );
    return dep;
  }

  // istanbul ignore else: not easy testable
  if (homepage) {
    // only assign if not assigned
    dep.sourceUrl ??= homepage;
    dep.homepage ??= homepage;
  }

  return dep;
}
