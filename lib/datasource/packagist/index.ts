import URL from 'url';
import pAll from 'p-all';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { cache } from '../../util/cache/package/decorator';
import * as hostRules from '../../util/host-rules';
import type { HttpOptions } from '../../util/http';
import { regEx } from '../../util/regex';
import { ensureTrailingSlash, joinUrlParts } from '../../util/url';
import * as composerVersioning from '../../versioning/composer';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type {
  AllPackages,
  PackageMeta,
  PackagistFile,
  RegistryFile,
  RegistryMeta,
} from './types';

export class PackagistDatasource extends Datasource {
  static readonly id = 'packagist';

  constructor() {
    super(PackagistDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://packagist.org'];

  override readonly defaultVersioning = composerVersioning.id;

  override readonly registryStrategy = 'hunt';

  public override getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult> {
    logger.trace(`getReleases(${lookupName})`);
    return this.packageLookup(registryUrl, lookupName);
  }

  // We calculate auth at this datasource layer so that we can know whether it's safe to cache or not
  private static getHostOpts(url: string): HttpOptions {
    let opts: HttpOptions = {};
    const { username, password } = hostRules.find({
      hostType: PackagistDatasource.id,
      url,
    });
    if (username && password) {
      opts = { ...opts, username, password };
    }
    return opts;
  }

  private async getRegistryMeta(regUrl: string): Promise<RegistryMeta | null> {
    const url = URL.resolve(ensureTrailingSlash(regUrl), 'packages.json');
    const opts = PackagistDatasource.getHostOpts(url);
    const res = (await this.http.getJson<PackageMeta>(url, opts)).body;
    const meta: RegistryMeta = {
      providerPackages: {},
    };
    meta.packages = res.packages;
    if (res.includes) {
      meta.includesFiles = [];
      for (const [name, val] of Object.entries(res.includes)) {
        const file = {
          key: name.replace(val.sha256, '%hash%'),
          sha256: val.sha256,
        };
        meta.includesFiles.push(file);
      }
    }
    if (res['providers-url']) {
      meta.providersUrl = res['providers-url'];
    }
    if (res['providers-lazy-url']) {
      meta.providersLazyUrl = res['providers-lazy-url'];
    }
    if (res['provider-includes']) {
      meta.files = [];
      for (const [key, val] of Object.entries(res['provider-includes'])) {
        const file = {
          key,
          sha256: val.sha256,
        };
        meta.files.push(file);
      }
    }
    if (res.providers) {
      for (const [key, val] of Object.entries(res.providers)) {
        meta.providerPackages[key] = val.sha256;
      }
    }
    return meta;
  }

  private async getPackagistFile(
    regUrl: string,
    file: RegistryFile
  ): Promise<PackagistFile> {
    const { key, sha256 } = file;
    const fileName = key.replace('%hash%', sha256);
    const opts = PackagistDatasource.getHostOpts(regUrl);
    if (opts.password || opts.headers?.authorization) {
      return (
        await this.http.getJson<PackagistFile>(regUrl + '/' + fileName, opts)
      ).body;
    }
    const cacheNamespace = 'datasource-packagist-files';
    const cacheKey = regUrl + key;
    // Check the persistent cache for public registries
    const cachedResult = await packageCache.get(cacheNamespace, cacheKey);
    // istanbul ignore if
    if (cachedResult && cachedResult.sha256 === sha256) {
      return cachedResult.res as Promise<PackagistFile>;
    }
    const res = (
      await this.http.getJson<PackagistFile>(regUrl + '/' + fileName, opts)
    ).body;
    const cacheMinutes = 1440; // 1 day
    await packageCache.set(
      cacheNamespace,
      cacheKey,
      { res, sha256 },
      cacheMinutes
    );
    return res;
  }

  private static extractDepReleases(versions: RegistryFile): ReleaseResult {
    const dep: ReleaseResult = { releases: null };
    // istanbul ignore if
    if (!versions) {
      dep.releases = [];
      return dep;
    }
    dep.releases = Object.keys(versions).map((version) => {
      const release = versions[version];
      dep.homepage = release.homepage || dep.homepage;
      if (release.source?.url) {
        dep.sourceUrl = release.source.url;
      }
      return {
        version: version.replace(regEx(/^v/), ''),
        gitRef: version,
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
      const resolvedFiles = await pAll(queue, { concurrency: 5 });
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
      packages,
      providersUrl,
      providersLazyUrl,
      providerPackages,
      includesPackages,
    };
    return allPackages;
  }

  async packagistOrgLookup(name: string): Promise<ReleaseResult> {
    const cacheNamespace = 'datasource-packagist-org';
    const cachedResult = await packageCache.get<ReleaseResult>(
      cacheNamespace,
      name
    );
    // istanbul ignore if
    if (cachedResult) {
      return cachedResult;
    }
    
    let dep: ReleaseResult = null;
    const regUrl = 'https://packagist.org';
    const pkgUrl = joinUrlParts(regUrl, `/p2/${name}.json`);
    // TODO: fix types (#9610)
    const res = (await this.http.getJson<any>(pkgUrl)).body.packages[name];
    if (res) {
      dep = PackagistDatasource.extractDepReleases(res);
      logger.trace({ dep }, 'dep');
    }
    const cacheMinutes = 10;
    await packageCache.set(cacheNamespace, name, dep, cacheMinutes);
    return dep;
  }

  private async packageLookup(
    regUrl: string,
    name: string
  ): Promise<ReleaseResult | null> {
    try {
      if (regUrl === 'https://packagist.org') {
        const packagistResult = await this.packagistOrgLookup(name);
        return packagistResult;
      }
      const allPackages = await this.getAllPackages(regUrl);
      const {
        packages,
        providersUrl,
        providersLazyUrl,
        providerPackages,
        includesPackages,
      } = allPackages;
      if (packages?.[name]) {
        const dep = PackagistDatasource.extractDepReleases(packages[name]);
        return dep;
      }
      if (includesPackages?.[name]) {
        return includesPackages[name];
      }
      let pkgUrl:string;
      if (name in providerPackages) {
        pkgUrl = URL.resolve(
          regUrl,
          providersUrl
            .replace('%package%', name)
            .replace('%hash%', providerPackages[name])
        );
      } else if (providersLazyUrl) {
        pkgUrl = URL.resolve(
          regUrl,
          providersLazyUrl.replace('%package%', name)
        );
      } else {
        return null;
      }
      const opts = PackagistDatasource.getHostOpts(regUrl);
      // TODO: fix types (#9610)
      const versions = (await this.http.getJson<any>(pkgUrl, opts)).body
        .packages[name];
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