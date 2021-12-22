import hasha from 'hasha';
import Git from 'simple-git';
import upath from 'upath';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import * as memCache from '../../util/cache/memory';
import { cache } from '../../util/cache/package/decorator';
import { privateCacheDir, readFile } from '../../util/fs';
import { simpleGitConfig } from '../../util/git/config';
import { regEx } from '../../util/regex';
import * as cargoVersioning from '../../versioning/cargo';
import { Datasource } from '../datasource';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types';
import { CrateRecord, RegistryFlavor, RegistryInfo } from './types';

export class CrateDatasource extends Datasource {
  static readonly id = 'crate';

  constructor() {
    super(CrateDatasource.id);
  }

  override defaultRegistryUrls = ['https://crates.io'];

  override defaultVersioning = cargoVersioning.id;

  static readonly CRATES_IO_BASE_URL =
    'https://raw.githubusercontent.com/rust-lang/crates.io-index/master/';

  @cache({
    namespace: `datasource-${CrateDatasource.id}`,
    key: ({ registryUrl, lookupName }: GetReleasesConfig) =>
      `${registryUrl}/${lookupName}`,
    cacheable: ({ registryUrl }: GetReleasesConfig) =>
      CrateDatasource.areReleasesCacheable(registryUrl),
  })
  async getReleases({
    lookupName,
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
      lookupName,
      registryUrl,
    });
    if (!registryInfo) {
      logger.debug({ registryUrl }, 'Could not fetch registry info');
      return null;
    }

    const dependencyUrl = CrateDatasource.getDependencyUrl(
      registryInfo,
      lookupName
    );

    const payload = await this.fetchCrateRecordsPayload(
      registryInfo,
      lookupName
    );
    const lines = payload
      .split('\n') // break into lines
      .map((line) => line.trim()) // remove whitespace
      .filter((line) => line.length !== 0) // remove empty lines
      .map((line) => JSON.parse(line) as CrateRecord); // parse
    const result: ReleaseResult = {
      dependencyUrl,
      releases: [],
    };
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

  public async fetchCrateRecordsPayload(
    info: RegistryInfo,
    lookupName: string
  ): Promise<string> {
    if (info.clonePath) {
      const path = upath.join(
        info.clonePath,
        ...CrateDatasource.getIndexSuffix(lookupName)
      );
      return readFile(path, 'utf8');
    }

    if (info.flavor === RegistryFlavor.CratesIo) {
      const crateUrl =
        CrateDatasource.CRATES_IO_BASE_URL +
        CrateDatasource.getIndexSuffix(lookupName).join('/');
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
    lookupName: string
  ): string {
    switch (info.flavor) {
      case RegistryFlavor.CratesIo:
        return `https://crates.io/crates/${lookupName}`;
      case RegistryFlavor.Cloudsmith: {
        // input: https://dl.cloudsmith.io/basic/$org/$repo/cargo/index.git
        const tokens = info.url.pathname.split('/');
        const org = tokens[2];
        const repo = tokens[3];
        return `https://cloudsmith.io/~${org}/repos/${repo}/packages/detail/cargo/${lookupName}`;
      }
      default:
        return `${info.rawUrl}/${lookupName}`;
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
    }).substr(0, 7);

    return `crate-registry-${proto}-${host}-${hash}`;
  }

  /**
   * Fetches information about a registry, by url.
   * If no url is given, assumes crates.io.
   * If an url is given, assumes it's a valid Git repository
   * url and clones it to cache.
   */
  private static async fetchRegistryInfo({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<RegistryInfo | null> {
    let url: URL;
    try {
      url = new URL(registryUrl);
    } catch (err) {
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

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
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
            { err, lookupName, registryUrl },
            'failed cloning git registry'
          );
          memCache.set(cacheKeyForError, err);

          return null;
        }
      }

      if (!clonePath) {
        const err = memCache.get(cacheKeyForError);
        logger.warn(
          { err, lookupName, registryUrl },
          'Previous git clone failed, bailing out.'
        );

        return null;
      }

      registry.clonePath = clonePath;
    }

    return registry;
  }

  private static areReleasesCacheable(registryUrl: string): boolean {
    // We only cache public releases, we don't want to cache private
    // cloned data between runs.
    return registryUrl === 'https://crates.io';
  }

  public static getIndexSuffix(lookupName: string): string[] {
    const len = lookupName.length;

    if (len === 1) {
      return ['1', lookupName];
    }
    if (len === 2) {
      return ['2', lookupName];
    }
    if (len === 3) {
      return ['3', lookupName[0], lookupName];
    }

    return [lookupName.slice(0, 2), lookupName.slice(2, 4), lookupName];
  }
}
