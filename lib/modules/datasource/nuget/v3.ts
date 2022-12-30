import is from '@sindresorhus/is';
import semver from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as packageCache from '../../../util/cache/package';
import { Http, HttpError } from '../../../util/http';
import * as p from '../../../util/promises';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash } from '../../../util/url';
import type { Release, ReleaseResult } from '../types';
import { massageUrl, removeBuildMeta } from './common';
import type {
  CatalogEntry,
  CatalogPage,
  PackageRegistration,
  ServicesIndexRaw,
} from './types';

const cacheNamespace = 'datasource-nuget';

export async function getResourceUrl(
  http: Http,
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
      .sort((x, y) =>
        x.version && y.version ? semver.compare(x.version, y.version) : 0
      );
    const { serviceId, version } = services.pop()!;

    // istanbul ignore if
    if (
      resourceType === 'RegistrationsBaseUrl' &&
      version &&
      !version.startsWith('3.0.0-') &&
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
    // istanbul ignore if: not easy testable with nock
    if (err instanceof ExternalHostError) {
      throw err;
    }
    logger.debug(
      { err, url },
      `nuget registry failure: can't get ${resourceType}`
    );
    return null;
  }
}

async function getCatalogEntry(
  http: Http,
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
  http: Http,
  registryUrl: string,
  feedUrl: string,
  pkgName: string
): Promise<ReleaseResult | null> {
  const baseUrl = feedUrl.replace(regEx(/\/*$/), '');
  const url = `${baseUrl}/${pkgName.toLowerCase()}/index.json`;
  const packageRegistration = await http.getJson<PackageRegistration>(url);
  const catalogPages = packageRegistration.body.items || [];
  const catalogPagesQueue = catalogPages.map(
    (page) => (): Promise<CatalogEntry[]> => getCatalogEntry(http, page)
  );
  const catalogEntries = (await p.all(catalogPagesQueue)).flat();

  let homepage: string | null = null;
  let latestStable: string | null = null;
  const releases = catalogEntries.map(
    ({ version, published: releaseTimestamp, projectUrl, listed }) => {
      const release: Release = { version: removeBuildMeta(version) };
      if (releaseTimestamp) {
        release.releaseTimestamp = releaseTimestamp;
      }
      if (semver.valid(version) && !semver.prerelease(version)) {
        latestStable = removeBuildMeta(version);
        homepage = projectUrl ? massageUrl(projectUrl) : homepage;
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
  if (latestStable === null && catalogPages.length) {
    const last = catalogEntries.pop()!;
    latestStable = removeBuildMeta(last.version);
    homepage ??= last.projectUrl ?? null;
  }

  const dep: ReleaseResult = {
    releases,
  };

  try {
    const packageBaseAddress = await getResourceUrl(
      http,
      registryUrl,
      'PackageBaseAddress'
    );
    // istanbul ignore else: this is a required v3 api
    if (is.nonEmptyString(packageBaseAddress)) {
      const nuspecUrl = `${ensureTrailingSlash(
        packageBaseAddress
      )}${pkgName.toLowerCase()}/${
        // TODO: types (#7154)
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        latestStable
      }/${pkgName.toLowerCase()}.nuspec`;
      const metaresult = await http.get(nuspecUrl);
      const nuspec = new XmlDocument(metaresult.body);
      const sourceUrl = nuspec.valueWithPath('metadata.repository@url');
      if (sourceUrl) {
        dep.sourceUrl = massageUrl(sourceUrl);
      }
    }
  } catch (err) {
    // istanbul ignore if: not easy testable with nock
    if (err instanceof ExternalHostError) {
      throw err;
    }
    // ignore / silence 404. Seen on proget, if remote connector is used and package is not yet cached
    if (err instanceof HttpError && err.response?.statusCode === 404) {
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
