import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { privateCacheDir, readCacheFile } from '../../../util/fs/index.ts';
import { createSimpleGit } from '../../../util/git/index.ts';
import { toSha256 } from '../../../util/hash.ts';
import { HttpError } from '../../../util/http/index.ts';
import { acquireLock } from '../../../util/mutex.ts';
import { regEx } from '../../../util/regex.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import { isHttpUrl, parseUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { VcpkgPortVersions } from './schema.ts';

const defaultRegistryUrl = 'https://github.com/microsoft/vcpkg';
// The default registry's files, served without a clone.
const defaultRegistryFilesUrl =
  'https://raw.githubusercontent.com/microsoft/vcpkg/master';

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

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return [defaultRegistryUrl];
  }

  override readonly defaultVersioning = 'vcpkg';

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

    const portFile = `versions/${packageName.charAt(0).toLowerCase()}-/${packageName}.json`;
    let portVersions: VcpkgPortVersions | null;
    if (registryUrl === defaultRegistryUrl) {
      portVersions = await this.fetchPortVersions(portFile);
    } else {
      portVersions = await VcpkgDatasource.readClonedPortVersions(
        registryUrl,
        portFile,
      );
    }
    if (!portVersions) {
      return null;
    }

    const releases: Release[] = portVersions.versions.map((entry) => {
      const upstream =
        entry.version ??
        entry['version-semver'] ??
        entry['version-date'] ??
        /* v8 ignore next -- schema guarantees one is set */
        entry['version-string']!;
      const portVersion = entry['port-version'] ?? 0;
      const version = portVersion > 0 ? `${upstream}#${portVersion}` : upstream;
      return { version };
    });

    return { releases };
  }

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${VcpkgDatasource.id}`,
        key: buildCacheKey(
          'getReleases',
          config.registryUrl,
          config.packageName,
        ),
        // A custom registry may be private.
        public: config.registryUrl === defaultRegistryUrl,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  /**
   * Returns the port's versions file from the default registry, or `null` if
   * the registry has no such port.
   */
  private async fetchPortVersions(
    portFile: string,
  ): Promise<VcpkgPortVersions | null> {
    try {
      return await this.fetchJsonOrNull(
        `${defaultRegistryFilesUrl}/${portFile}`,
        VcpkgPortVersions,
      );
    } catch (err) {
      if (err instanceof HttpError && err.response?.statusCode === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Returns the port's versions file from a clone of a custom registry, or
   * `null` if the registry has no such port or may not be cloned.
   */
  private static async readClonedPortVersions(
    registryUrl: string,
    portFile: string,
  ): Promise<VcpkgPortVersions | null> {
    // A repository's config must not make the Renovate host clone any URL,
    // with the host's own credentials, unless the admin allows it.
    if (!GlobalConfig.get('allowCustomVcpkgRegistries')) {
      logger.once.warn(
        { registryUrl },
        'vcpkg datasource: allowCustomVcpkgRegistries=true is required for cloning registries other than the default one',
      );
      return null;
    }

    const url = parseUrl(registryUrl);
    if (!url) {
      logger.debug(`Could not parse registry URL ${registryUrl}`);
      return null;
    }

    const clonePath = await VcpkgDatasource.fetchClonePath(registryUrl, url);
    try {
      const content = await readCacheFile(
        upath.join(clonePath, portFile),
        'utf8',
      );
      return Json.pipe(VcpkgPortVersions).parse(content);
    } catch (err) {
      logger.debug(
        { err, portFile, registryUrl },
        'vcpkg datasource: could not read or parse port versions file',
      );
      return null;
    }
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

  /**
   * Returns the path of the registry's clone, cloning it once per run. Throws
   * if the clone fails, so that the package cache serves the releases from an
   * earlier run.
   */
  private static async fetchClonePath(
    registryUrl: string,
    url: URL,
  ): Promise<string> {
    const cacheKey = buildCacheKey(
      'vcpkg-datasource',
      'registry-clone-path',
      registryUrl,
    );
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
        logger.debug(
          { err: cached.err, registryUrl },
          'Previous git clone failed, bailing out.',
        );
        throw cached.err;
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
        throw result.err;
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
      ...(isHttpUrl(registryFetchUrl) && {
        // The host rules' credentials for this registry, which `registryUrls`
        // cannot carry.
        authentication: {
          hostTypes: [VcpkgDatasource.id],
          url: registryFetchUrl,
        },
      }),
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
