import upath from 'upath';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import { buildCacheKey } from '../../../util/cache/package/key.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import {
  privateCacheDir,
  readCacheFile,
  rmCache,
} from '../../../util/fs/index.ts';
import { createSimpleGit } from '../../../util/git/index.ts';
import { toSha256 } from '../../../util/hash.ts';
import { acquireLock } from '../../../util/mutex.ts';
import { regEx } from '../../../util/regex.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { isHttpUrl } from '../../../util/url.ts';
import * as juliaVersioning from '../../versioning/julia/index.ts';
import { Datasource } from '../datasource.ts';
import { JuliaGeneralMetadataDatasource } from '../julia-general-metadata/index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { Package, Registry, Versions } from './schema.ts';

// Pkg knows General by its UUID and its name: `pkg> registry add General`.
const generalRegistryUuid = '23338594-aafe-5451-b93e-139f81909106';
const generalRegistryRegex = regEx(
  /^(?:General|https:\/\/github\.com\/JuliaRegistries\/General(?:\.git)?)$/,
);
const generalMetadata = new JuliaGeneralMetadataDatasource();

// `ssh://host/path` or scp-like `git@host:path`. A word character comes
// first, so that git cannot take the URL for an option.
const sshUrlRegex = regEx(/^(?:ssh:\/\/|\w[\w.-]*@[\w.-]+:)/);
const versionLineRegex = regEx(/^\t\["(?<version>[^"]+)"\]$/);

export class JuliaDatasource extends Datasource {
  static readonly id = 'julia';

  constructor() {
    super(JuliaDatasource.id);
  }

  override getDefaultRegistryUrls(_packageName: string): string[] {
    return ['General'];
  }

  override readonly defaultVersioning = juliaVersioning.id;

  // A package is in one of the registries, so try each until one has it.
  override readonly registryStrategy = 'hunt';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'For General, the release timestamp is the `registered` time from GeneralMetadata.jl. For a cloned registry, it is the commit time of the commit that added the version to `Versions.toml`.';

  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    "For a cloned registry, the source URL is determined from the `repo` field in the package's `Package.toml`. General's packages have no source URL.";

  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore if -- should never happen */
    if (!registryUrl) {
      return null;
    }

    // GeneralMetadata.jl serves General's versions without a clone.
    if (
      generalRegistryRegex.test(registryUrl) ||
      registryUrl.toLowerCase() === generalRegistryUuid
    ) {
      return generalMetadata.getReleases({
        packageName,
        registryUrl: generalMetadata.getDefaultRegistryUrls(packageName)[0],
      });
    }

    // Other transports, such as `file://`, would clone from the Renovate host.
    if (!isHttpUrl(registryUrl) && !sshUrlRegex.test(registryUrl)) {
      logger.debug({ registryUrl }, 'Unsupported Julia registry URL');
      return null;
    }

    // A repository's config must not make the Renovate host clone any URL,
    // with the host's own credentials, unless the admin allows it.
    if (!GlobalConfig.get('allowCustomJuliaRegistries')) {
      logger.once.warn(
        { registryUrl },
        'julia datasource: allowCustomJuliaRegistries=true is required for cloning registries other than General',
      );
      return null;
    }

    // A cloned registry may be private, so its releases are cached only with
    // `cachePrivatePackages`.
    return withCache(
      {
        namespace: `datasource-${JuliaDatasource.id}`,
        key: buildCacheKey(registryUrl, packageName),
        public: false,
        fallback: true,
      },
      () => JuliaDatasource.getClonedReleases(registryUrl, packageName),
    );
  }

  /**
   * Returns a package's releases from a clone of the registry.
   */
  private static async getClonedReleases(
    registryUrl: string,
    packageName: string,
  ): Promise<ReleaseResult | null> {
    const clonePath = await JuliaDatasource.cloneRegistry(registryUrl);
    if (!clonePath) {
      return null;
    }

    const registry = await JuliaDatasource.getRegistry(registryUrl, clonePath);
    const path = JuliaDatasource.findPackagePath(registry, packageName);
    if (!path) {
      return null;
    }

    // The path comes from the registry, so it must not lead out of the clone.
    const packagePath = upath.join(clonePath, path);
    if (upath.relative(clonePath, packagePath).startsWith('..')) {
      logger.debug(
        { registryUrl, path },
        'Julia package path is outside the registry',
      );
      return null;
    }
    const releases = Versions.parse(
      await readCacheFile(upath.join(packagePath, 'Versions.toml'), 'utf8'),
    );
    const { repo } = Package.parse(
      await readCacheFile(upath.join(packagePath, 'Package.toml'), 'utf8'),
    );

    const timestamps = await JuliaDatasource.getRegistrationTimestamps(
      clonePath,
      upath.join(path, 'Versions.toml'),
    );
    for (const release of releases) {
      const timestamp = timestamps.get(release.version);
      if (timestamp) {
        release.releaseTimestamp = timestamp;
      }
    }
    return { releases, ...(repo && { sourceUrl: repo }) };
  }

  /**
   * Parses the clone's `Registry.toml` once per run.
   */
  private static async getRegistry(
    registryUrl: string,
    clonePath: string,
  ): Promise<Registry> {
    const cacheKey = buildCacheKey(
      `datasource-${JuliaDatasource.id}`,
      'registry',
      registryUrl,
    );
    const cached = memCache.get<Registry>(cacheKey);
    if (cached) {
      return cached;
    }

    const registry = Registry.parse(
      await readCacheFile(upath.join(clonePath, 'Registry.toml'), 'utf8'),
    );
    memCache.set(cacheKey, registry);
    return registry;
  }

  /**
   * Finds a package's directory in the registry.
   *
   * `Example=7876af07-990d-54b4-ab0e-23690620f79a` names a package and its
   * UUID, as Pkg's REPL does, and matches only that package. A name alone is
   * unique only within a registry, so a name that matches several packages
   * finds none.
   */
  private static findPackagePath(
    registry: Registry,
    packageName: string,
  ): string | null {
    const [name, uuid] = packageName.split('=');
    if (uuid) {
      const entry = registry.packages[uuid.toLowerCase()];
      return entry?.name === name ? entry.path : null;
    }

    const matches = Object.values(registry.packages).filter(
      (entry) => entry.name === name,
    );
    if (matches.length > 1) {
      logger.debug(
        { packageName, count: matches.length },
        'Julia package name is ambiguous, add its UUID',
      );
    }
    return matches.length === 1 ? matches[0].path : null;
  }

  /**
   * Returns when each version was registered: the commit time of the commit
   * that added the version to `Versions.toml`, following the registry's main
   * line of commits as GeneralMetadata.jl does.
   */
  private static async getRegistrationTimestamps(
    clonePath: string,
    versionsPath: string,
  ): Promise<Map<string, Timestamp>> {
    const timestamps = new Map<string, Timestamp>();
    let blame: string;
    try {
      blame = await createSimpleGit({ config: { baseDir: clonePath } }).raw([
        'blame',
        '--first-parent',
        '--line-porcelain',
        '--',
        versionsPath,
      ]);
    } catch (err) {
      logger.debug(
        { err, versionsPath },
        'git blame of the Julia registry failed',
      );
      return timestamps;
    }

    // `--line-porcelain` gives each line's commit details, then the line.
    let committerTime: string | undefined;
    for (const line of blame.split('\n')) {
      if (line.startsWith('committer-time ')) {
        committerTime = line.slice('committer-time '.length);
        continue;
      }
      const version = versionLineRegex.exec(line)?.groups?.version;
      if (version && committerTime) {
        // `committer-time` is in seconds since the epoch.
        const timestamp = asTimestamp(parseInt(committerTime, 10) * 1000);
        if (timestamp) {
          timestamps.set(version, timestamp);
        }
      }
    }
    return timestamps;
  }

  /**
   * Clones the registry once per run and returns the clone's path, or null if
   * the clone failed.
   */
  private static async cloneRegistry(
    registryUrl: string,
  ): Promise<string | null> {
    const cacheKey = buildCacheKey(
      `datasource-${JuliaDatasource.id}`,
      'clone-path',
      registryUrl,
    );
    const executionTimeout = GlobalConfig.get('executionTimeout') * 60 * 1000;
    const gitTimeout = GlobalConfig.get('gitTimeout') || executionTimeout;
    const releaseLock = await acquireLock(
      registryUrl,
      JuliaDatasource.id,
      gitTimeout,
    );
    try {
      const cached = memCache.get<string | null>(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      const clonePath = upath.join(
        privateCacheDir(),
        `${JuliaDatasource.id}-${toSha256(registryUrl).substring(0, 7)}`,
      );
      const git = createSimpleGit({
        config: { maxConcurrentProcesses: 1 },
        ...(isHttpUrl(registryUrl) && {
          authentication: {
            hostTypes: [JuliaDatasource.id],
            url: registryUrl,
          },
        }),
      });
      let result: string | null = clonePath;
      try {
        // A clone from an earlier run would make `git clone` fail.
        await rmCache(clonePath);
        // Not shallow: the history gives the registration timestamps.
        await git.clone(registryUrl, clonePath);
      } catch (err) {
        logger.warn({ err, registryUrl }, 'Failed to clone Julia registry');
        result = null;
      }
      memCache.set(cacheKey, result);
      return result;
    } finally {
      releaseLock();
    }
  }
}
