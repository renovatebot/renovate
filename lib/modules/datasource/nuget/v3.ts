import is from '@sindresorhus/is';
import extract from 'extract-zip';
import semver from 'semver';
import upath from 'upath';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as packageCache from '../../../util/cache/package';
import { cache } from '../../../util/cache/package/decorator';
import * as fs from '../../../util/fs';
import { ensureCacheDir } from '../../../util/fs';
import type { Http } from '../../../util/http';
import { HttpError } from '../../../util/http';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider';
import * as p from '../../../util/promises';
import { regEx } from '../../../util/regex';
import { asTimestamp } from '../../../util/timestamp';
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
  static readonly cacheNamespace = 'datasource-nuget-v3';

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

    /* v8 ignore next 3 -- TODO: add test */
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
      if (!servicesIndexRaw) {
        servicesIndexRaw = (
          await http.getJsonUnchecked<ServicesIndexRaw>(url, {
            cacheProvider: memCacheProvider,
          })
        ).body;
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
      const catalogPageFull = await http.getJsonUnchecked<CatalogPage>(url);
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
    const packageRegistration =
      await http.getJsonUnchecked<PackageRegistration>(url);
    const catalogPages = packageRegistration.body.items || [];
    const catalogPagesQueue = catalogPages.map(
      (page) => (): Promise<CatalogEntry[]> => this.getCatalogEntry(http, page),
    );
    const catalogEntries = (await p.all(catalogPagesQueue))
      .flat()
      .sort((a, b) => sortNugetVersions(a.version, b.version));

    let homepage: string | null = null;
    let latestStable: string | null = null;
    let nupkgUrl: string | null = null;
    const releases = catalogEntries.map(
      ({ version, published, projectUrl, listed, packageContent }) => {
        const release: Release = { version: removeBuildMeta(version) };
        const releaseTimestamp = asTimestamp(published);
        if (releaseTimestamp) {
          release.releaseTimestamp = releaseTimestamp;
        }
        if (versioning.isValid(version) && versioning.isStable(version)) {
          latestStable = removeBuildMeta(version);
          homepage = projectUrl ? massageUrl(projectUrl) : homepage;
          nupkgUrl = massageUrl(packageContent);
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
      nupkgUrl ??= massageUrl(last.packageContent);
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
      if (is.nonEmptyString(packageBaseAddress)) {
        const nuspecUrl = `${ensureTrailingSlash(
          packageBaseAddress,
        )}${pkgName.toLowerCase()}/${
          // TODO: types (#22198)
          latestStable
        }/${pkgName.toLowerCase()}.nuspec`;
        const metaresult = await http.getText(nuspecUrl, {
          cacheProvider: memCacheProvider,
        });
        const nuspec = new XmlDocument(metaresult.body);
        const sourceUrl = nuspec.valueWithPath('metadata.repository@url');
        if (sourceUrl) {
          dep.sourceUrl = massageUrl(sourceUrl);
        }
      } else if (nupkgUrl) {
        const sourceUrl = await this.getSourceUrlFromNupkg(
          http,
          registryUrl,
          pkgName,
          latestStable,
          nupkgUrl,
        );
        if (sourceUrl) {
          dep.sourceUrl = massageUrl(sourceUrl);
          logger.debug(`Determined sourceUrl ${sourceUrl} from ${nupkgUrl}`);
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
      } else {
        logger.debug(
          { err, registryUrl, pkgName, pkgVersion: latestStable },
          `Cannot obtain sourceUrl`,
        );
      }
    }

    if (homepage) {
      // only assign if not assigned
      dep.sourceUrl ??= homepage;
      dep.homepage ??= homepage;
    }

    return dep;
  }

  @cache({
    namespace: NugetV3Api.cacheNamespace,
    key: (
      _http: Http,
      registryUrl: string,
      packageName: string,
      _packageVersion: string | null,
      _nupkgUrl: string,
    ) => `source-url:${registryUrl}:${packageName}`,
    ttlMinutes: 10080, // 1 week
  })
  async getSourceUrlFromNupkg(
    http: Http,
    _registryUrl: string,
    packageName: string,
    packageVersion: string | null,
    nupkgUrl: string,
  ): Promise<string | null> {
    // istanbul ignore if: experimental feature
    if (!process.env.RENOVATE_X_NUGET_DOWNLOAD_NUPKGS) {
      logger.once.debug('RENOVATE_X_NUGET_DOWNLOAD_NUPKGS is not set');
      return null;
    }
    const cacheDir = await ensureCacheDir('nuget');
    const nupkgFile = upath.join(
      cacheDir,
      `${packageName}.${packageVersion}.nupkg`,
    );
    const nupkgContentsDir = upath.join(
      cacheDir,
      `${packageName}.${packageVersion}`,
    );
    const readStream = http.stream(nupkgUrl);
    try {
      const writeStream = fs.createCacheWriteStream(nupkgFile);
      await fs.pipeline(readStream, writeStream);
      await extract(nupkgFile, { dir: nupkgContentsDir });
      const nuspecFile = upath.join(nupkgContentsDir, `${packageName}.nuspec`);
      const nuspec = new XmlDocument(
        await fs.readCacheFile(nuspecFile, 'utf8'),
      );
      return nuspec.valueWithPath('metadata.repository@url') ?? null;
    } finally {
      await fs.rmCache(nupkgFile);
      await fs.rmCache(nupkgContentsDir);
    }
  }
}
