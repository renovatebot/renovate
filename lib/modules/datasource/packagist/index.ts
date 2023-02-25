import type { z } from 'zod';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import * as hostRules from '../../../util/host-rules';
import type { HttpOptions } from '../../../util/http/types';
import * as p from '../../../util/promises';
import { joinUrlParts, resolveBaseUrl } from '../../../util/url';
import * as composerVersioning from '../../versioning/composer';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import {
  PackagesResponse,
  PackagistFile,
  RegistryFile,
  RegistryMeta,
  extractDepReleases,
  parsePackagesResponses,
} from './schema';

export class PackagistDatasource extends Datasource {
  static readonly id = 'packagist';

  constructor() {
    super(PackagistDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://packagist.org'];

  override readonly defaultVersioning = composerVersioning.id;

  override readonly registryStrategy = 'hunt';

  // We calculate auth at this datasource layer so that we can know whether it's safe to cache or not
  private static getHostOpts(url: string): HttpOptions {
    const { username, password } = hostRules.find({
      hostType: PackagistDatasource.id,
      url,
    });
    return username && password ? { username, password } : {};
  }

  private async getJson<T, U extends z.ZodSchema<T>>(
    url: string,
    schema: U
  ): Promise<z.infer<typeof schema>> {
    const opts = PackagistDatasource.getHostOpts(url);
    const { body } = await this.http.getJson(url, opts);
    return schema.parse(body);
  }

  @cache({
    namespace: `datasource-${PackagistDatasource.id}`,
    key: (regUrl: string) => `getRegistryMeta:${regUrl}`,
  })
  async getRegistryMeta(regUrl: string): Promise<RegistryMeta> {
    const url = resolveBaseUrl(regUrl, 'packages.json');
    const result = await this.getJson(url, RegistryMeta);
    return result;
  }

  private static isPrivatePackage(regUrl: string): boolean {
    const opts = PackagistDatasource.getHostOpts(regUrl);
    return !!opts.password;
  }

  private static getPackagistFileUrl(
    regUrl: string,
    regFile: RegistryFile
  ): string {
    const { key, sha256 } = regFile;
    const fileName = key.replace('%hash%', sha256);
    const url = `${regUrl}/${fileName}`;
    return url;
  }

  @cache({
    namespace: `datasource-${PackagistDatasource.id}-public-files`,
    key: (regUrl: string, regFile: RegistryFile) =>
      PackagistDatasource.getPackagistFileUrl(regUrl, regFile),
    cacheable: (regUrl: string) =>
      !PackagistDatasource.isPrivatePackage(regUrl),
    ttlMinutes: 1440,
  })
  async getPackagistFile(
    regUrl: string,
    regFile: RegistryFile
  ): Promise<PackagistFile> {
    const url = PackagistDatasource.getPackagistFileUrl(regUrl, regFile);
    const packagistFile = await this.getJson(url, PackagistFile);
    return packagistFile;
  }

  async fetchProviderPackages(
    regUrl: string,
    meta: RegistryMeta
  ): Promise<void> {
    await p.map(meta.files, async (file) => {
      const res = await this.getPackagistFile(regUrl, file);
      Object.assign(meta.providerPackages, res.providers);
    });
  }

  async fetchIncludesPackages(
    regUrl: string,
    meta: RegistryMeta
  ): Promise<void> {
    await p.map(meta.includesFiles, async (file) => {
      const res = await this.getPackagistFile(regUrl, file);
      for (const [key, val] of Object.entries(res.packages)) {
        meta.includesPackages[key] = extractDepReleases(val);
      }
    });
  }

  @cache({
    namespace: `datasource-${PackagistDatasource.id}-org`,
    key: (regUrl: string) => regUrl,
    ttlMinutes: 10,
  })
  async packagistOrgLookup(name: string): Promise<ReleaseResult | null> {
    const regUrl = 'https://packagist.org';
    const pkgUrl = joinUrlParts(regUrl, `/p2/${name}.json`);
    const devUrl = joinUrlParts(regUrl, `/p2/${name}~dev.json`);
    const results = await p.map([pkgUrl, devUrl], (url) =>
      this.http.getJson(url).then(({ body }) => body)
    );
    return parsePackagesResponses(name, results);
  }

  public getPkgUrl(
    packageName: string,
    registryUrl: string,
    registryMeta: RegistryMeta
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
      return resolveBaseUrl(registryUrl, url);
    }

    if (registryMeta.providersLazyUrl) {
      return resolveBaseUrl(
        registryUrl,
        registryMeta.providersLazyUrl.replace('%package%', packageName)
      );
    }

    return null;
  }

  public override async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.trace(`getReleases(${packageName})`);

    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    try {
      if (registryUrl === 'https://packagist.org') {
        const packagistResult = await this.packagistOrgLookup(packageName);
        return packagistResult;
      }

      const meta = await this.getRegistryMeta(registryUrl);

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
