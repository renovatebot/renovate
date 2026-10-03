import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { privateCacheDir, readCacheFile } from '../../../util/fs/index.ts';
import { createSimpleGit } from '../../../util/git/index.ts';
import { toSha256 } from '../../../util/hash.ts';
import { acquireLock } from '../../../util/mutex.ts';
import { regEx } from '../../../util/regex.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { parseUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { VcpkgPortVersions } from './schema.ts';

type CloneResult =
  | {
      err: Error;
      clonePath?: undefined;
    }
  | {
      clonePath: string;
      err?: undefined;
    };

export class VcpkgDatasource extends Datasource {
  static readonly id = 'vcpkg';

  constructor() {
    super(VcpkgDatasource.id);
  }

  override readonly defaultRegistryUrls = [
    'https://github.com/microsoft/vcpkg',
  ];

  override readonly defaultVersioning = 'vcpkg';

  override readonly customRegistrySupport = true;

  override readonly releaseTimestampSupport = false;

  override readonly sourceUrlSupport = 'none';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore if -- should never happen */
    if (!registryUrl) {
      logger.warn(
        'vcpkg datasource: No registryUrl specified, cannot perform getReleases',
      );
      return null;
    }

    const url = parseUrl(registryUrl);
    if (!url) {
      logger.debug(`Could not parse registry URL ${registryUrl}`);
      return null;
    }

    const clonePath = await VcpkgDatasource.fetchClonePath(registryUrl, url);
    if (!clonePath) {
      return null;
    }

    const firstLetter = packageName.charAt(0).toLowerCase();
    const portPath = upath.join(
      clonePath,
      'versions',
      `${firstLetter}-`,
      `${packageName}.json`,
    );

    let parsed: VcpkgPortVersions;
    try {
      const content = await readCacheFile(portPath, 'utf8');
      parsed = Json.pipe(VcpkgPortVersions).parse(content);
    } catch (err) {
      logger.debug(
        { err, packageName, registryUrl },
        'vcpkg datasource: could not read or parse port versions file',
      );
      return null;
    }

    const releases: Release[] = parsed.versions.map((entry) => {
      const upstream =
        entry.version ??
        entry['version-semver'] ??
        entry['version-date'] ??
        /* v8 ignore next -- schema guarantees one is set */
        entry['version-string']!;
      const portVersion = entry['port-version'] ?? 0;
      const version = portVersion > 0 ? `${upstream}#${portVersion}` : upstream;
      const release: Release = {
        version,
        newDigest: entry['git-tree'],
      };
      return release;
    });

    return { releases };
  }

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${VcpkgDatasource.id}`,
        key: `getReleases:${config.registryUrl}/${config.packageName}`,
        cacheable: true,
      },
      () => this._getReleases(config),
    );
  }

  /**
   * Given a Git URL, computes a semi-human-readable name for a folder in which
   * to clone the repository.
   */
  private static cacheDirFromUrl(url: URL): string {
    const proto = url.protocol.replace(regEx(/:$/), '');
    const host = url.hostname;
    const hash = toSha256(url.pathname).substring(0, 7);

    return `vcpkg-registry-${proto}-${host}-${hash}`;
  }

  private static async fetchClonePath(
    registryUrl: string,
    url: URL,
  ): Promise<string | null> {
    const cacheKey = `vcpkg-datasource/registry-clone-path/${registryUrl}`;
    const lockKey = registryUrl;

    const executionTimeout = GlobalConfig.get('executionTimeout') * 60 * 1000;
    const gitTimeout = GlobalConfig.get('gitTimeout') || executionTimeout;
    const releaseLock = await acquireLock(
      lockKey,
      'vcpkg-registry',
      gitTimeout,
    );
    try {
      const cached = memCache.get<CloneResult>(cacheKey);

      if (cached?.err) {
        logger.warn(
          { err: cached.err, registryUrl },
          'Previous git clone failed, bailing out.',
        );
        return null;
      }

      if (cached?.clonePath) {
        return cached.clonePath;
      }

      const clonePath = upath.join(
        privateCacheDir(),
        VcpkgDatasource.cacheDirFromUrl(url),
      );

      const result = await VcpkgDatasource.clone(registryUrl, clonePath);

      memCache.set(cacheKey, result);

      if (result.err) {
        logger.warn(
          { err: result.err, registryUrl },
          'Git clone failed, bailing out.',
        );
        return null;
      }

      return result.clonePath;
    } finally {
      releaseLock();
    }
  }

  private static async clone(
    registryFetchUrl: string,
    clonePath: string,
  ): Promise<CloneResult> {
    logger.info({ clonePath, registryFetchUrl }, `Cloning vcpkg registry`);

    const git = createSimpleGit({
      config: { maxConcurrentProcesses: 1 },
    });

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
          { registryFetchUrl },
          'failed to shallow clone vcpkg registry, doing full clone',
        );
        try {
          await git.clone(registryFetchUrl, clonePath);
          return { clonePath };
        } catch (err) {
          logger.warn(
            { err, registryFetchUrl },
            'failed cloning vcpkg registry',
          );
          return { err };
        }
      } else {
        logger.warn({ err, registryFetchUrl }, 'failed cloning vcpkg registry');
        return { err };
      }
    }
  }
}
