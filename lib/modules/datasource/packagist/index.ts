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
import * as schema from './schema';
import { extractDepReleases } from './schema';
import type { PackagistFile, RegistryFile } from './types';

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
    const url = resolveBaseUrl(regUrl, 'packages.json');
    const opts = PackagistDatasource.getHostOpts(url);
    const { body } = await this.http.getJson(url, opts);
    const meta = schema.RegistryMeta.parse(body);
    return meta;
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

  @cache({
    namespace: `datasource-${PackagistDatasource.id}`,
    key: (regUrl: string) => regUrl,
  })
  async getAllPackages(regUrl: string): Promise<schema.AllPackages> {
    const registryMeta = await this.getRegistryMeta(regUrl);

    const {
      packages,
      providersUrl,
      providersLazyUrl,
      files,
      includesFiles,
      providerPackages,
    } = registryMeta;

    const includesPackages: schema.AllPackages['includesPackages'] = {};

    const tasks: (() => Promise<void>)[] = [];

    for (const file of files) {
      tasks.push(async () => {
        const res = await this.getPackagistFile(regUrl, file);
        for (const [name, val] of Object.entries(res.providers)) {
          providerPackages[name] = val.sha256;
        }
      });
    }

    for (const file of includesFiles) {
      tasks.push(async () => {
        const res = await this.getPackagistFile(regUrl, file);
        for (const [key, val] of Object.entries(res.packages ?? {})) {
          includesPackages[key] = extractDepReleases(val);
        }
      });
    }

    await p.all(tasks);

    const allPackages: schema.AllPackages = {
      packages,
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
      const {
        packages,
        providersUrl,
        providersLazyUrl,
        providerPackages,
        includesPackages,
      } = allPackages;
      if (packages?.[packageName]) {
        const dep = extractDepReleases(packages[packageName]);
        return dep;
      }
      if (includesPackages?.[packageName]) {
        return includesPackages[packageName];
      }
      let pkgUrl: string;
      if (providersUrl && packageName in providerPackages) {
        let url = providersUrl.replace('%package%', packageName);
        const hash = providerPackages[packageName];
        if (hash) {
          url = url.replace('%hash%', hash);
        }
        pkgUrl = resolveBaseUrl(registryUrl, url);
      } else if (providersLazyUrl) {
        pkgUrl = resolveBaseUrl(
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
      const dep = extractDepReleases(versions);
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
