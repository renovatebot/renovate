import URL from 'url';
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import * as hostRules from '../../../util/host-rules';
import type { HttpOptions } from '../../../util/http/types';
import * as p from '../../../util/promises';
import { regEx } from '../../../util/regex';
import { ensureTrailingSlash, joinUrlParts } from '../../../util/url';
import * as composerVersioning from '../../versioning/composer';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import * as schema from './schema';
import type { AllPackages, PackagistFile, RegistryFile } from './types';

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

  private async getRegistryMeta(regUrl: string): Promise<schema.RegistryMeta> {
    const url = URL.resolve(ensureTrailingSlash(regUrl), 'packages.json');
    const opts = PackagistDatasource.getHostOpts(url);
    const { body } = await this.http.getJson(url, opts);
    const res = schema.RegistryMeta.parse(body);
    return res;
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
    const opts = PackagistDatasource.getHostOpts(regUrl);
    const { body: packagistFile } = await this.http.getJson<PackagistFile>(
      url,
      opts
    );
    return packagistFile;
  }

  private static extractDepReleases(versions: RegistryFile): ReleaseResult {
    const dep: ReleaseResult = { releases: [] };
    // istanbul ignore if
    if (!versions) {
      return dep;
    }
    dep.releases = Object.keys(versions).map((version) => {
      // TODO: fix function parameter type: `versions`
      const release = (versions as any)[version];
      const parsedVersion = release.version ?? version;
      dep.homepage = release.homepage || dep.homepage;
      if (release.source?.url) {
        dep.sourceUrl = release.source.url;
      }
      return {
        version: parsedVersion.replace(regEx(/^v/), ''),
        gitRef: parsedVersion,
        releaseTimestamp: release.time,
      };
    });
    return dep;
  }

  @cache({
    namespace: `datasource-${PackagistDatasource.id}`,
    key: (regUrl: string) => regUrl,
  })
  async getAllPackages(regUrl: string): Promise<AllPackages | null> {
    const registryMeta = await this.getRegistryMeta(regUrl);
    // istanbul ignore if: needs test
    if (!registryMeta) {
      return null;
    }

    const {
      packages,
      providersUrl,
      providersLazyUrl,
      files,
      includesFiles,
      providerPackages,
    } = registryMeta;
    if (files) {
      const queue = files.map(
        (file) => (): Promise<PackagistFile> =>
          this.getPackagistFile(regUrl, file)
      );
      const resolvedFiles = await p.all(queue);
      for (const res of resolvedFiles) {
        for (const [name, val] of Object.entries(res.providers)) {
          providerPackages[name] = val.sha256;
        }
      }
    }
    const includesPackages: Record<string, ReleaseResult> = {};
    if (includesFiles) {
      for (const file of includesFiles) {
        const res = await this.getPackagistFile(regUrl, file);
        if (res.packages) {
          for (const [key, val] of Object.entries(res.packages)) {
            const dep = PackagistDatasource.extractDepReleases(val);
            includesPackages[key] = dep;
          }
        }
      }
    }
    const allPackages: AllPackages = {
      packages: packages as never, // TODO: fix types (#9610)
      providersUrl,
      providersLazyUrl,
      providerPackages,
      includesPackages,
    };
    return allPackages;
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
    return schema.parsePackagesResponses(name, results);
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
      const allPackages = await this.getAllPackages(registryUrl);
      // istanbul ignore if: needs test
      if (!allPackages) {
        return null;
      }
      const {
        packages,
        providersUrl,
        providersLazyUrl,
        providerPackages,
        includesPackages,
      } = allPackages;
      if (packages?.[packageName]) {
        const dep = PackagistDatasource.extractDepReleases(
          packages[packageName]
        );
        return dep;
      }
      if (includesPackages?.[packageName]) {
        return includesPackages[packageName];
      }
      let pkgUrl: string;
      const hash = providerPackages[packageName];
      if (providersUrl && !is.undefined(hash)) {
        let url = providersUrl.replace('%package%', packageName);
        if (hash) {
          url = url.replace('%hash%', hash);
        }
        pkgUrl = URL.resolve(registryUrl, url);
      } else if (providersLazyUrl) {
        pkgUrl = URL.resolve(
          registryUrl,
          providersLazyUrl.replace('%package%', packageName)
        );
      } else {
        return null;
      }
      const opts = PackagistDatasource.getHostOpts(registryUrl);
      // TODO: fix types (#9610)
      const versions = (await this.http.getJson<any>(pkgUrl, opts)).body
        .packages[packageName];
      const dep = PackagistDatasource.extractDepReleases(versions);
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
