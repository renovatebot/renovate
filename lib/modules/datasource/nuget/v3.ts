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
import { api as versioning } from '../../versioning/nuget';
import type { Release, ReleaseResult } from '../types';
import { massageUrl, removeBuildMeta, sortNugetVersions } from './common';
import type {
  CatalogEntry,
  CatalogPage,
  PackageRegistration,
  ServicesIndexRaw,
} from './types';

export class NugetV3Api {
  static readonly cacheNamespace = 'datasource-nuget';

  async getResourceUrl(
    http: Http,
    url: string,
    resourceType = 'RegistrationsBaseUrl',
  ): Promise<string | null> {
    // https://docs.microsoft.com/en-us/nuget/api/service-index
    const resultCacheKey = `${url}:${resourceType}`;
    const cachedResult = await packageCache.get<string>(
      NugetV3Api.cacheNamespace,
      resultCacheKey,
    );

    // istanbul ignore if
    if (cachedResult) {
      return cachedResult;
    }
    let servicesIndexRaw: ServicesIndexRaw | undefined;
    try {
      const responseCacheKey = url;
      servicesIndexRaw = await packageCache.get<ServicesIndexRaw>(
        NugetV3Api.cacheNamespace,
        responseCacheKey,
      );
      // istanbul ignore else: currently not testable
      if (!servicesIndexRaw) {
        servicesIndexRaw = (await http.getJson<ServicesIndexRaw>(url)).body;
        await packageCache.set(
          NugetV3Api.cacheNamespace,
          responseCacheKey,
          servicesIndexRaw,
          3 * 24 * 60,
        );
      }

      const services = servicesIndexRaw.resources
        .map(({ '@id': serviceId, '@type': t }) => ({
          serviceId,
          type: t?.split('/')?.shift(),
          version: t?.split('/')?.pop(),
        }))
        .filter(
          ({ type, version }) => type === resourceType && semver.valid(version),
        )
        .sort((x, y) =>
          x.version && y.version
            ? semver.compare(x.version, y.version)
            : /* istanbul ignore next: hard to test */ 0,
        );

      if (services.length === 0) {
        await packageCache.set(
          NugetV3Api.cacheNamespace,
          resultCacheKey,
          null,
          60,
        );
        logger.debug(
          { url, servicesIndexRaw },
          `no ${resourceType} services found`,
        );
        return null;
      }

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
          `Nuget: Unknown version returned. Only v3 is supported`,
        );
      }

      await packageCache.set(
        NugetV3Api.cacheNamespace,
        resultCacheKey,
        serviceId,
        60,
      );
      return serviceId;
    } catch (err) {
      // istanbul ignore if: not easy testable with nock
      if (err instanceof ExternalHostError) {
        throw err;
      }
      logger.debug(
        { err, url, servicesIndexRaw },
        `nuget registry failure: can't get ${resourceType}`,
      );
      return null;
    }
  }

  async getCatalogEntry(
    http: Http,
    catalogPage: CatalogPage,
  ): Promise<CatalogEntry[]> {
    let items = catalogPage.items;
    if (!items) {
      const url = catalogPage['@id'];
      const catalogPageFull = await http.getJson<CatalogPage>(url);
      items = catalogPageFull.body.items;
    }
    return items.map(({ catalogEntry }) => catalogEntry);
  }

  async getReleases(
    http: Http,
    registryUrl: string,
    feedUrl: string,
    pkgName: string,
  ): Promise<ReleaseResult | null> {
    const baseUrl = feedUrl.replace(regEx(/\/*$/), '');
    const url = `${baseUrl}/${pkgName.toLowerCase()}/index.json`;
    const packageRegistration = await http.getJson<PackageRegistration>(url);
    const catalogPages = packageRegistration.body.items || [];
    const catalogPagesQueue = catalogPages.map(
      (page) => (): Promise<CatalogEntry[]> => this.getCatalogEntry(http, page),
    );
    const catalogEntries = (await p.all(catalogPagesQueue))
      .flat()
      .sort((a, b) => sortNugetVersions(a.version, b.version));

    let homepage: string | null = null;
    let latestStable: string | null = null;
    const releases = catalogEntries.map(
      ({ version, published: releaseTimestamp, projectUrl, listed }) => {
        const release: Release = { version: removeBuildMeta(version) };
        if (releaseTimestamp) {
          release.releaseTimestamp = releaseTimestamp;
        }
        if (versioning.isValid(version) && versioning.isStable(version)) {
          latestStable = removeBuildMeta(version);
          homepage = projectUrl ? massageUrl(projectUrl) : homepage;
        }
        if (listed === false) {
          release.isDeprecated = true;
        }
        return release;
      },
    );

    if (!releases.length) {
      return null;
    }

    // istanbul ignore next: only happens when no stable version exists
    if (latestStable === null && catalogPages.length) {
      const last = catalogEntries.pop()!;
      latestStable = removeBuildMeta(last.version);
      homepage ??= last.projectUrl ?? null;
    }

    const dep: ReleaseResult = {
      releases,
    };

    try {
      const packageBaseAddress = await this.getResourceUrl(
        http,
        registryUrl,
        'PackageBaseAddress',
      );
      // istanbul ignore else: this is a required v3 api
      if (is.nonEmptyString(packageBaseAddress)) {
        const nuspecUrl = `${ensureTrailingSlash(
          packageBaseAddress,
        )}${pkgName.toLowerCase()}/${
          // TODO: types (#22198)
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
          `package manifest (.nuspec) not found`,
        );
        return dep;
      }
      logger.debug(
        { err, registryUrl, pkgName, pkgVersion: latestStable },
        `Cannot obtain sourceUrl`,
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
}
