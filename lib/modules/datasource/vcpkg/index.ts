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
import { GithubHttp } from '../../../util/http/github.ts';
import { findMatchingRule } from '../../../util/http/host-rules.ts';
import { HttpError } from '../../../util/http/index.ts';
import { acquireLock } from '../../../util/mutex.ts';
import { regEx } from '../../../util/regex.ts';
import { Json } from '../../../util/schema-utils/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { asTimestamp } from '../../../util/timestamp.ts';
import { isHttpUrl, parseUrl } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { GetReleasesConfig, Release, ReleaseResult } from '../types.ts';
import { VcpkgBlameResponse, VcpkgPortVersions } from './schema.ts';

const defaultRegistryUrl = 'https://github.com/microsoft/vcpkg';
// The default registry's files, served without a clone.
const defaultRegistryFilesUrl =
  'https://raw.githubusercontent.com/microsoft/vcpkg/HEAD';
const githubGraphqlUrl = 'https://api.github.com/graphql';

// The text and the blame of a versions file, from the same commit.
const blameQuery = `
query ($path: String!) {
  repository(owner: "microsoft", name: "vcpkg") {
    object(expression: "HEAD") {
      ... on Commit {
        file(path: $path) {
          object {
            ... on Blob {
              text
            }
          }
        }
        blame(path: $path) {
          ranges {
            startingLine
            endingLine
            commit {
              committedDate
            }
          }
        }
      }
    }
  }
}`;

// The line of a versions file entry that names its port's tree, which differs
// for each version.
const gitTreeLineRegex = regEx(/"git-tree"\s*:\s*"(?<gitTree>[0-9a-f]+)"/);

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

  override readonly releaseTimestampSupport = true;

  override readonly releaseTimestampNote =
    "The release timestamp is the commit time of the commit that added the version to the port's versions file. For the default registry, it is read with the GitHub GraphQL API, which needs a github.com token.";

  private readonly githubHttp = new GithubHttp(VcpkgDatasource.id);

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
    let timestamps: Map<string, Timestamp>;
    if (registryUrl === defaultRegistryUrl) {
      portVersions = await this.fetchPortVersions(portFile);
      if (!portVersions) {
        return null;
      }
      timestamps = await this.fetchVersionTimestamps(portFile);
    } else {
      const clonePath = await VcpkgDatasource.getClonePath(registryUrl);
      if (!clonePath) {
        return null;
      }
      portVersions = await VcpkgDatasource.readClonedPortVersions(
        registryUrl,
        clonePath,
        portFile,
      );
      if (!portVersions) {
        return null;
      }
      timestamps = await VcpkgDatasource.blameVersionTimestamps(
        clonePath,
        portFile,
      );
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
      const releaseTimestamp = timestamps.get(entry['git-tree']);
      return releaseTimestamp ? { version, releaseTimestamp } : { version };
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
   * Returns when each version of the default registry's port was added, by the
   * `git-tree` of its entry. Empty without a github.com token, or if GitHub
   * returns no blame.
   */
  private async fetchVersionTimestamps(
    portFile: string,
  ): Promise<Map<string, Timestamp>> {
    const timestamps = new Map<string, Timestamp>();
    const { token } = findMatchingRule(githubGraphqlUrl, {
      hostType: VcpkgDatasource.id,
      readOnly: true,
    });
    if (!token) {
      logger.once.debug(
        'vcpkg datasource: no github.com token, so no release timestamps for the default registry',
      );
      return timestamps;
    }

    const { body } = await this.githubHttp.postJson(githubGraphqlUrl, {
      body: { query: blameQuery, variables: { path: portFile } },
      readOnly: true,
    });
    const blame = VcpkgBlameResponse.safeParse(body);
    if (!blame.success) {
      logger.debug(
        { portFile, err: blame.error },
        'vcpkg datasource: no blame of the versions file from GitHub',
      );
      return timestamps;
    }

    const { text, ranges } = blame.data;
    const lines = text.split('\n');
    for (const { startingLine, endingLine, committedDate } of ranges) {
      // Blame ranges count lines from 1.
      for (const line of lines.slice(startingLine - 1, endingLine)) {
        const gitTree = gitTreeLineRegex.exec(line)?.groups?.gitTree;
        if (gitTree) {
          timestamps.set(gitTree, committedDate);
        }
      }
    }
    return timestamps;
  }

  /**
   * Returns the path of a custom registry's clone, or `null` if the registry
   * may not be cloned.
   */
  private static async getClonePath(
    registryUrl: string,
  ): Promise<string | null> {
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

    return await VcpkgDatasource.fetchClonePath(registryUrl, url);
  }

  /**
   * Returns the port's versions file from a clone of a custom registry, or
   * `null` if the registry has no such port.
   */
  private static async readClonedPortVersions(
    registryUrl: string,
    clonePath: string,
    portFile: string,
  ): Promise<VcpkgPortVersions | null> {
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
   * Returns when each version of a cloned registry's port was added, by the
   * `git-tree` of its entry: the commit time of the commit that added the
   * entry, following the registry's main line of commits.
   */
  private static async blameVersionTimestamps(
    clonePath: string,
    portFile: string,
  ): Promise<Map<string, Timestamp>> {
    const timestamps = new Map<string, Timestamp>();
    let blame: string;
    try {
      blame = await createSimpleGit({ config: { baseDir: clonePath } }).raw([
        'blame',
        '--first-parent',
        '--line-porcelain',
        '--',
        portFile,
      ]);
    } catch (err) {
      logger.debug(
        { err, portFile },
        'vcpkg datasource: git blame of the versions file failed',
      );
      return timestamps;
    }

    // `--line-porcelain` gives each line's commit details, then the line.
    let committerTime = '';
    for (const line of blame.split('\n')) {
      if (line.startsWith('committer-time ')) {
        committerTime = line.slice('committer-time '.length);
        continue;
      }
      const gitTree = gitTreeLineRegex.exec(line)?.groups?.gitTree;
      if (gitTree) {
        // `committer-time` is in seconds since the epoch.
        const timestamp = asTimestamp(parseInt(committerTime, 10) * 1000);
        if (timestamp) {
          timestamps.set(gitTree, timestamp);
        }
      }
    }
    return timestamps;
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
      // A clone from an earlier run would make `git clone` fail.
      await rmCache(clonePath);
      // Not shallow: the history gives the release timestamps.
      await git.clone(registryFetchUrl, clonePath);
      return { clonePath };
    } catch (err) {
      logger.warn({ err, registryFetchUrl }, 'failed cloning vcpkg registry');
      return { err };
    }
  }
}
