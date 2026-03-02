import { simpleGit } from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { getChildEnv } from '../../../util/exec/utils.ts';
import { privateCacheDir, readCacheFile } from '../../../util/fs/index.ts';
import { simpleGitConfig } from '../../../util/git/config.ts';
import { toSha256 } from '../../../util/hash.ts';
import { memCacheProvider } from '../../../util/http/cache/memory-http-cache-provider.ts';
import { acquireLock } from '../../../util/mutex.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { joinUrlParts, parseUrl } from '../../../util/url.ts';
import * as cargoVersioning from '../../versioning/cargo/index.ts';
import { Datasource } from '../datasource.ts';
import type {
  GetReleasesConfig,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  Release,
  ReleaseResult,
} from '../types.ts';
import { ReleaseTimestamp } from './schema.ts';
import type {
  CrateMetadata,
  CrateRecord,
  RegistryFlavor,
  RegistryInfo,
} from './types.ts';

type CloneResult =
  | {
      err: Error;
      clonePath?: undefined;
    }
  | {
      clonePath: string;
      err?: undefined;
    };

export class CrateDatasource extends Datasource {
  static readonly id = 'crate';

  constructor() {
    super(CrateDatasource.id);
  }

  override defaultRegistryUrls = ['https://crates.io'];

  override defaultVersioning = cargoVersioning.id;

  static readonly CRATES_IO_BASE_URL =
    'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

  static readonly CRATES_IO_API_BASE_URL = 'https://crates.io/api/v1/';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the `repository` field in the results.';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from `pubtime` field from crates.io index if available, or `version.created_at` field from crates.io API otherwise.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore if -- should never happen */
    if (!registryUrl) {
      logger.warn(
        'crate datasource: No registryUrl specified, cannot perform getReleases',
      );
      return null;
    }

    const registryInfo = await CrateDatasource.fetchRegistryInfo({
      packageName,
      registryUrl,
    });
    if (!registryInfo) {
      logger.debug(`Could not fetch registry info from ${registryUrl}`);
      return null;
    }

    const dependencyUrl = CrateDatasource.getDependencyUrl(
      registryInfo,
      packageName,
    );

    const payload = await this.fetchCrateRecordsPayload(
      registryInfo,
      packageName,
    );
    const lines = payload
      .split(newlineRegex) // break into lines
      .map((line) => line.trim()) // remove whitespace
      .filter((line) => line.length !== 0) // remove empty lines
      .map((line) => JSON.parse(line) as CrateRecord); // parse

    const metadata = await this.getCrateMetadata(registryInfo, packageName);

    const result: ReleaseResult = {
      dependencyUrl,
      releases: [],
    };

    if (metadata?.homepage) {
      result.homepage = metadata.homepage;
    }

    if (metadata?.repository) {
      result.sourceUrl = metadata.repository;
    }

    result.releases = lines
      .map((line) => {
        const versionOrig = line.vers;
        const version = versionOrig.replace(/\+.*$/, '');
        const release: Release = { version };

        if (versionOrig !== version) {
          release.versionOrig = versionOrig;
        }

        if (line.yanked) {
          release.isDeprecated = true;
        }

        if (line.rust_version) {
          release.constraints = { rust: [line.rust_version] };
        }

        if (line.pubtime) {
          release.releaseTimestamp = asTimestamp(line.pubtime);
        }

        return release;
      })
      .filter((release) => release.version);
    if (!result.releases.length) {
      return null;
    }

    return result;
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${CrateDatasource.id}`,
        // TODO: types (#22198)
        key: `${config.registryUrl}/${config.packageName}`,
        cacheable: CrateDatasource.areReleasesCacheable(config.registryUrl),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private async _getCrateMetadata(
    info: RegistryInfo,
    packageName: string,
  ): Promise<CrateMetadata | null> {
    if (info.flavor !== 'crates.io') {
      return null;
    }

    // The `?include=` suffix is required to avoid unnecessary database queries
    // on the crates.io server. This lets us work around the regular request
    // throttling of one request per second.
    const crateUrl = `${CrateDatasource.CRATES_IO_API_BASE_URL}crates/${packageName}?include=`;

    logger.debug(
      { crateUrl, packageName, registryUrl: info.rawUrl },
      'downloading crate metadata',
    );

    try {
      interface Response {
        crate: CrateMetadata;
      }
      const response = await this.http.getJsonUnchecked<Response>(crateUrl);
      return response.body.crate;
    } catch (err) {
      logger.warn(
        { err, packageName, registryUrl: info.rawUrl },
        'failed to download crate metadata',
      );
    }

    return null;
  }

  public getCrateMetadata(
    info: RegistryInfo,
    packageName: string,
  ): Promise<CrateMetadata | null> {
    return withCache(
      {
        namespace: `datasource-${CrateDatasource.id}-metadata`,
        key: `${info.rawUrl}/${packageName}`,
        cacheable: CrateDatasource.areReleasesCacheable(info.rawUrl),
        ttlMinutes: 24 * 60, // 24 hours
      },
      () => this._getCrateMetadata(info, packageName),
    );
  }

  public async fetchCrateRecordsPayload(
    info: RegistryInfo,
    packageName: string,
  ): Promise<string> {
    if (info.clonePath) {
      const path = upath.join(
        info.clonePath,
        ...CrateDatasource.getIndexSuffix(packageName),
      );
      return readCacheFile(path, 'utf8');
    }

    const baseUrl =
      info.flavor === 'crates.io'
        ? CrateDatasource.CRATES_IO_BASE_URL
        : info.rawUrl;

    if (info.flavor === 'crates.io' || info.isSparse) {
      const packageSuffix = CrateDatasource.getIndexSuffix(
        packageName.toLowerCase(),
      );
      const crateUrl = joinUrlParts(baseUrl, ...packageSuffix);
      try {
        return (await this.http.getText(crateUrl)).body;
      } catch (err) {
        this.handleGenericErrors(err);
      }
    }
    throw new Error(`unsupported crate registry flavor: ${info.flavor}`);
  }

  /**
   * Computes the dependency URL for a crate, given
   * registry information
   */
  private static getDependencyUrl(
    info: RegistryInfo,
    packageName: string,
  ): string {
    switch (info.flavor) {
      case 'crates.io':
        return `https://crates.io/crates/${packageName}`;
      case 'cloudsmith': {
        // input: https://dl.cloudsmith.io/basic/$org/$repo/cargo/index.git
        const tokens = info.url.pathname.split('/');
        const org = tokens[2];
        const repo = tokens[3];
        return `https://cloudsmith.io/~${org}/repos/${repo}/packages/detail/cargo/${packageName}`;
      }
      default:
        return `${info.rawUrl}/${packageName}`;
    }
  }

  /**
   * Given a Git URL, computes a semi-human-readable name for a folder in which to
   * clone the repository.
   */
  private static cacheDirFromUrl(url: URL): string {
    const proto = url.protocol.replace(regEx(/:$/), '');
    const host = url.hostname;
    const hash = toSha256(url.pathname).substring(0, 7);

    return `crate-registry-${proto}-${host}-${hash}`;
  }

  private static isSparseRegistry(url: string): boolean {
    const parsed = parseUrl(url);
    if (!parsed) {
      return false;
    }
    return parsed.protocol.startsWith('sparse+');
  }

  /**
   * Fetches information about a registry, by url.
   * If no url is given, assumes crates.io.
   * If an url is given, assumes it's a valid Git repository
   * url and clones it to cache.
   */
  private static async fetchRegistryInfo({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<RegistryInfo | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const isSparseRegistry = CrateDatasource.isSparseRegistry(registryUrl);
    const registryFetchUrl = isSparseRegistry
      ? registryUrl.replace(/^sparse\+/, '')
      : registryUrl;

    const url = parseUrl(registryFetchUrl);
    if (!url) {
      logger.debug(`Could not parse registry URL ${registryFetchUrl}`);
      return null;
    }

    let flavor: RegistryFlavor;
    if (url.hostname === 'crates.io') {
      flavor = 'crates.io';
    } else if (url.hostname === 'dl.cloudsmith.io') {
      flavor = 'cloudsmith';
    } else {
      flavor = 'other';
    }

    const registry: RegistryInfo = {
      flavor,
      rawUrl: registryFetchUrl,
      url,
      isSparse: isSparseRegistry,
    };

    if (
      registry.flavor !== 'crates.io' &&
      !GlobalConfig.get('allowCustomCrateRegistries')
    ) {
      logger.warn(
        'crate datasource: allowCustomCrateRegistries=true is required for registries other than crates.io, bailing out',
      );
      return null;
    }
    if (registry.flavor !== 'crates.io' && !registry.isSparse) {
      const cacheKey = `crate-datasource/registry-clone-path/${registryFetchUrl}`;
      const lockKey = registryFetchUrl;

      const executionTimeout =
        GlobalConfig.get('executionTimeout', 15) * 60 * 1000;
      const gitTimeout = GlobalConfig.get('gitTimeout', executionTimeout);
      const releaseLock = await acquireLock(
        lockKey,
        'crate-registry',
        gitTimeout,
      );
      try {
        const cached = memCache.get<CloneResult>(cacheKey);

        if (cached?.err) {
          logger.warn(
            { err: cached.err, packageName, registryFetchUrl },
            'Previous git clone failed, bailing out.',
          );
          return null;
        }

        if (cached?.clonePath) {
          registry.clonePath = cached.clonePath;
          return registry;
        }

        const clonePath = upath.join(
          privateCacheDir(),
          CrateDatasource.cacheDirFromUrl(url),
        );

        const result = await CrateDatasource.clone(
          registryFetchUrl,
          clonePath,
          packageName,
        );

        memCache.set(cacheKey, result);

        if (result.err) {
          logger.warn(
            { err: result.err, packageName, registryFetchUrl },
            'Git clone failed, bailing out.',
          );
          return null;
        }

        registry.clonePath = result.clonePath;
      } finally {
        releaseLock();
      }
    }

    return registry;
  }

  private static async clone(
    registryFetchUrl: string,
    clonePath: string,
    packageName: string,
  ): Promise<CloneResult> {
    logger.info(
      { clonePath, registryFetchUrl },
      `Cloning private cargo registry`,
    );

    const git = simpleGit({
      ...simpleGitConfig(),
      maxConcurrentProcesses: 1,
    }).env(getChildEnv());

    try {
      await git.clone(registryFetchUrl, clonePath, {
        '--depth': 1,
      });
      return { clonePath };
    } catch (err) {
      if (
        err.message.includes(
          'fatal: dumb http transport does not support shallow capabilities',
        )
      ) {
        logger.info(
          { packageName, registryFetchUrl },
          'failed to shallow clone git registry, doing full clone',
        );
        try {
          await git.clone(registryFetchUrl, clonePath);
          return { clonePath };
        } catch (err) {
          logger.warn(
            { err, packageName, registryFetchUrl },
            'failed cloning git registry',
          );
          return { err };
        }
      } else {
        logger.warn(
          { err, packageName, registryFetchUrl },
          'failed cloning git registry',
        );
        return { err };
      }
    }
  }

  private static areReleasesCacheable(
    registryUrl: string | undefined,
  ): boolean {
    // We only cache public releases, we don't want to cache private
    // cloned data between runs.
    return registryUrl === 'https://crates.io';
  }

  public static getIndexSuffix(packageName: string): string[] {
    const len = packageName.length;

    if (len === 1) {
      return ['1', packageName];
    }
    if (len === 2) {
      return ['2', packageName];
    }
    if (len === 3) {
      return ['3', packageName[0], packageName];
    }

    return [packageName.slice(0, 2), packageName.slice(2, 4), packageName];
  }

  private async _postprocessRelease(
    { packageName, registryUrl }: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult> {
    if (release.releaseTimestamp || registryUrl !== 'https://crates.io') {
      return release;
    }

    const url = `https://crates.io/api/v1/crates/${packageName}/${release.versionOrig ?? release.version}`;
    // Getting release timestamp could become unnecessary if the manual backfill of `pubtime` mentioned in
    // https://github.com/rust-lang/cargo/issues/15491 is done for all packages.
    const { body: releaseTimestamp } = await this.http.getJson(
      url,
      { cacheProvider: memCacheProvider },
      ReleaseTimestamp,
    );
    release.releaseTimestamp = releaseTimestamp;
    return release;
  }

  override postprocessRelease(
    config: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult> {
    return withCache(
      {
        namespace: `datasource-crate`,
        key: `postprocessRelease:${config.registryUrl}:${config.packageName}:${release.version}`,
        ttlMinutes: 7 * 24 * 60,
        cacheable: config.registryUrl === 'https://crates.io',
      },
      () => this._postprocessRelease(config, release),
    );
  }
}
