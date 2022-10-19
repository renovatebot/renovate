import hasha from 'hasha';
import Git from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../../config/global';
import { logger } from '../../../logger';
import * as memCache from '../../../util/cache/memory';
import { cache } from '../../../util/cache/package/decorator';
import { privateCacheDir, readCacheFile } from '../../../util/fs';
import { simpleGitConfig } from '../../../util/git/config';
import { newlineRegex, regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import * as cargoVersioning from '../../versioning/cargo';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import {
  CrateMetadata,
  CrateRecord,
  RegistryFlavor,
  RegistryInfo,
} from './types';

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

  @cache({
    namespace: `datasource-${CrateDatasource.id}`,
    key: ({ registryUrl, packageName }: GetReleasesConfig) =>
      // TODO: types (#7154)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      `${registryUrl}/${packageName}`,
    cacheable: ({ registryUrl }: GetReleasesConfig) =>
      CrateDatasource.areReleasesCacheable(registryUrl),
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      logger.warn(
        'crate datasource: No registryUrl specified, cannot perform getReleases'
      );
      return null;
    }

    const registryInfo = await CrateDatasource.fetchRegistryInfo({
      packageName,
      registryUrl,
    });
    if (!registryInfo) {
      logger.debug({ registryUrl }, 'Could not fetch registry info');
      return null;
    }

    const dependencyUrl = CrateDatasource.getDependencyUrl(
      registryInfo,
      packageName
    );

    const payload = await this.fetchCrateRecordsPayload(
      registryInfo,
      packageName
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
      .map((version) => {
        const release: Release = {
          version: version.vers,
        };
        if (version.yanked) {
          release.isDeprecated = true;
        }
        return release;
      })
      .filter((release) => release.version);
    if (!result.releases.length) {
      return null;
    }

    return result;
  }

  @cache({
    namespace: `datasource-${CrateDatasource.id}-metadata`,
    key: (info: RegistryInfo, packageName: string) =>
      `${info.rawUrl}/${packageName}`,
    cacheable: (info: RegistryInfo) =>
      CrateDatasource.areReleasesCacheable(info.rawUrl),
    ttlMinutes: 24 * 60, // 24 hours
  })
  public async getCrateMetadata(
    info: RegistryInfo,
    packageName: string
  ): Promise<CrateMetadata | null> {
    if (info.flavor !== RegistryFlavor.CratesIo) {
      return null;
    }

    // The `?include=` suffix is required to avoid unnecessary database queries
    // on the crates.io server. This lets us work around the regular request
    // throttling of one request per second.
    const crateUrl = `${CrateDatasource.CRATES_IO_API_BASE_URL}crates/${packageName}?include=`;

    logger.debug(
      { crateUrl, packageName, registryUrl: info.rawUrl },
      'downloading crate metadata'
    );

    try {
      type Response = { crate: CrateMetadata };
      const response = await this.http.getJson<Response>(crateUrl);
      return response.body.crate;
    } catch (err) {
      logger.warn(
        { err, packageName, registryUrl: info.rawUrl },
        'failed to download crate metadata'
      );
    }

    return null;
  }

  public async fetchCrateRecordsPayload(
    info: RegistryInfo,
    packageName: string
  ): Promise<string> {
    if (info.clonePath) {
      const path = upath.join(
        info.clonePath,
        ...CrateDatasource.getIndexSuffix(packageName)
      );
      return readCacheFile(path, 'utf8');
    }

    if (info.flavor === RegistryFlavor.CratesIo) {
      const crateUrl =
        CrateDatasource.CRATES_IO_BASE_URL +
        CrateDatasource.getIndexSuffix(packageName.toLowerCase()).join('/');
      try {
        return (await this.http.get(crateUrl)).body;
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
    packageName: string
  ): string {
    switch (info.flavor) {
      case RegistryFlavor.CratesIo:
        return `https://crates.io/crates/${packageName}`;
      case RegistryFlavor.Cloudsmith: {
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
    const hash = hasha(url.pathname, {
      algorithm: 'sha256',
    }).substring(0, 7);

    return `crate-registry-${proto}-${host}-${hash}`;
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
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const url = parseUrl(registryUrl);
    if (!url) {
      logger.debug({ registryUrl }, 'could not parse registry URL');
      return null;
    }

    let flavor: RegistryFlavor;
    if (url.hostname === 'crates.io') {
      flavor = RegistryFlavor.CratesIo;
    } else if (url.hostname === 'dl.cloudsmith.io') {
      flavor = RegistryFlavor.Cloudsmith;
    } else {
      flavor = RegistryFlavor.Other;
    }

    const registry: RegistryInfo = {
      flavor,
      rawUrl: registryUrl,
      url,
    };

    if (flavor !== RegistryFlavor.CratesIo) {
      if (!GlobalConfig.get('allowCustomCrateRegistries')) {
        logger.warn(
          'crate datasource: allowCustomCrateRegistries=true is required for registries other than crates.io, bailing out'
        );
        return null;
      }

      const cacheKey = `crate-datasource/registry-clone-path/${registryUrl}`;
      const cacheKeyForError = `crate-datasource/registry-clone-path/${registryUrl}/error`;

      // We need to ensure we don't run `git clone` in parallel. Therefore we store
      // a promise of the running operation in the mem cache, which in the end resolves
      // to the file path of the cloned repository.

      const clonePathPromise: Promise<string> | null = memCache.get(cacheKey);
      let clonePath: string;

      if (clonePathPromise) {
        clonePath = await clonePathPromise;
      } else {
        clonePath = upath.join(
          privateCacheDir(),
          CrateDatasource.cacheDirFromUrl(url)
        );
        logger.info(
          { clonePath, registryUrl },
          `Cloning private cargo registry`
        );

        const git = Git({ ...simpleGitConfig(), maxConcurrentProcesses: 1 });
        const clonePromise = git.clone(registryUrl, clonePath, {
          '--depth': 1,
        });

        memCache.set(
          cacheKey,
          clonePromise.then(() => clonePath).catch(() => null)
        );

        try {
          await clonePromise;
        } catch (err) {
          logger.warn(
            { err, packageName, registryUrl },
            'failed cloning git registry'
          );
          memCache.set(cacheKeyForError, err);

          return null;
        }
      }

      if (!clonePath) {
        const err = memCache.get(cacheKeyForError);
        logger.warn(
          { err, packageName, registryUrl },
          'Previous git clone failed, bailing out.'
        );

        return null;
      }

      registry.clonePath = clonePath;
    }

    return registry;
  }

  private static areReleasesCacheable(
    registryUrl: string | undefined
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
}
