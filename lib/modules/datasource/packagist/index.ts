import { isObject } from '@sindresorhus/is';
import { z } from 'zod/v3';
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as hostRules from '../../../util/host-rules.ts';
import type { HttpOptions } from '../../../util/http/types.ts';
import * as p from '../../../util/promises.ts';
import { replaceUrlPath, resolveBaseUrl } from '../../../util/url.ts';
import * as composerVersioning from '../../versioning/composer/index.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import type { RegistryFile } from './schema.ts';
import {
  PackagesResponse,
  PackagistFile,
  RegistryMeta,
  extractDepReleases,
  parsePackagesResponses,
} from './schema.ts';

export class PackagistDatasource extends Datasource {
  static readonly id = 'packagist';

  constructor() {
    super(PackagistDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://repo.packagist.org'];

  override readonly defaultVersioning = composerVersioning.id;

  override readonly registryStrategy = 'hunt';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `time` field in the results.';
  // Note: this can be changed to 'release', as the source is present in each release but we remove it while processing
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from `source` field in the results.';

  // We calculate auth at this datasource layer so that we can know whether it's safe to cache or not
  private static getHostOpts(url: string): HttpOptions {
    const { username, password } = hostRules.find({
      hostType: PackagistDatasource.id,
      url,
    });
    return username && password ? { username, password } : {};
  }

  private async getJson<Schema extends z.ZodType<any, any, any>>(
    url: string,
    schema: Schema,
  ): Promise<z.infer<Schema>> {
    const opts = PackagistDatasource.getHostOpts(url);
    const { body } = await this.http.getJson(url, opts, schema);
    return body;
  }

  private async _getRegistryMeta(regUrl: string): Promise<RegistryMeta> {
    const url = resolveBaseUrl(regUrl, 'packages.json');
    const result = await this.getJson(url, RegistryMeta);
    return result;
  }

  getRegistryMeta(regUrl: string): Promise<RegistryMeta> {
    return withCache(
      {
        namespace: `datasource-${PackagistDatasource.id}`,
        key: `getRegistryMeta:${regUrl}`,
      },
      () => this._getRegistryMeta(regUrl),
    );
  }

  private static isPrivatePackage(regUrl: string): boolean {
    const opts = PackagistDatasource.getHostOpts(regUrl);
    return !!opts.password;
  }

  private static getPackagistFileUrl(
    regUrl: string,
    regFile: RegistryFile,
  ): string {
    const { key, hash } = regFile;
    const fileName = hash
      ? key.replace('%hash%', hash)
      : /* istanbul ignore next: hard to test */ key;
    const url = resolveBaseUrl(regUrl, fileName);
    return url;
  }

  private async _getPackagistFile(
    regUrl: string,
    regFile: RegistryFile,
  ): Promise<PackagistFile> {
    const url = PackagistDatasource.getPackagistFileUrl(regUrl, regFile);
    const packagistFile = await this.getJson(url, PackagistFile);
    return packagistFile;
  }

  getPackagistFile(
    regUrl: string,
    regFile: RegistryFile,
  ): Promise<PackagistFile> {
    return withCache(
      {
        namespace: `datasource-${PackagistDatasource.id}`,
        key: `getPackagistFile:${PackagistDatasource.getPackagistFileUrl(regUrl, regFile)}`,
        ttlMinutes: 1440,
        cacheable: !PackagistDatasource.isPrivatePackage(regUrl),
      },
      () => this._getPackagistFile(regUrl, regFile),
    );
  }

  async fetchProviderPackages(
    regUrl: string,
    meta: RegistryMeta,
  ): Promise<void> {
    await p.map(meta.files, async (file) => {
      const res = await this.getPackagistFile(regUrl, file);
      Object.assign(meta.providerPackages, res.providers);
    });
  }

  async fetchIncludesPackages(
    regUrl: string,
    meta: RegistryMeta,
  ): Promise<void> {
    await p.map(meta.includesFiles, async (file) => {
      const res = await this.getPackagistFile(regUrl, file);
      for (const [key, val] of Object.entries(res.packages)) {
        meta.includesPackages[key] = extractDepReleases(val);
      }
    });
  }

  private async _packagistV2Lookup(
    registryUrl: string,
    metadataUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const pkgUrl = replaceUrlPath(
      registryUrl,
      metadataUrl.replace('%package%', packageName),
    );
    const pkgPromise = this.getJson(pkgUrl, z.unknown());

    const devUrl = replaceUrlPath(
      registryUrl,
      metadataUrl.replace('%package%', `${packageName}~dev`),
    );
    const devPromise = this.getJson(devUrl, z.unknown()).then(
      (x) => x,
      () => null,
    );

    const responses: NonNullable<unknown>[] = await Promise.all([
      pkgPromise,
      devPromise,
    ]).then((responses) => responses.filter(isObject));
    return parsePackagesResponses(packageName, responses);
  }

  packagistV2Lookup(
    registryUrl: string,
    metadataUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${PackagistDatasource.id}`,
        key: `packagistV2Lookup:${registryUrl}:${metadataUrl}:${packageName}`,
        ttlMinutes: 10,
      },
      () => this._packagistV2Lookup(registryUrl, metadataUrl, packageName),
    );
  }

  public getPkgUrl(
    packageName: string,
    registryUrl: string,
    registryMeta: RegistryMeta,
  ): string | null {
    if (
      registryMeta.providersUrl &&
      packageName in registryMeta.providerPackages
    ) {
      let url = registryMeta.providersUrl.replace('%package%', packageName);
      const hash = registryMeta.providerPackages[packageName];
      if (hash) {
        url = url.replace('%hash%', hash);
      }
      return replaceUrlPath(registryUrl, url);
    }

    if (registryMeta.providersLazyUrl) {
      return replaceUrlPath(
        registryUrl,
        registryMeta.providersLazyUrl.replace('%package%', packageName),
      );
    }

    return null;
  }

  public override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace(`getReleases(${packageName})`);

    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    try {
      const meta = await this.getRegistryMeta(registryUrl);

      if (
        meta.availablePackages &&
        !meta.availablePackages.includes(packageName)
      ) {
        return null;
      }

      if (meta.metadataUrl) {
        const packagistResult = await this.packagistV2Lookup(
          registryUrl,
          meta.metadataUrl,
          packageName,
        );
        return packagistResult;
      }

      if (meta.packages[packageName]) {
        const result = extractDepReleases(meta.packages[packageName]);
        return result;
      }

      await this.fetchIncludesPackages(registryUrl, meta);
      if (meta.includesPackages[packageName]) {
        return meta.includesPackages[packageName];
      }

      await this.fetchProviderPackages(registryUrl, meta);
      const pkgUrl = this.getPkgUrl(packageName, registryUrl, meta);
      if (!pkgUrl) {
        return null;
      }

      const pkgRes = await this.getJson(pkgUrl, PackagesResponse);
      const dep = extractDepReleases(pkgRes.packages[packageName]);
      logger.trace({ dep }, 'dep');
      return dep;
    } catch (err) /* istanbul ignore next */ {
      if (err.host === 'packagist.org') {
        if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
          throw new ExternalHostError(err);
        }
        if (err.statusCode && err.statusCode >= 500 && err.statusCode < 600) {
          throw new ExternalHostError(err);
        }
      }
      throw err;
    }
  }
}
