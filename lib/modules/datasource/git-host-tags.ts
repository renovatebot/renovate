import type { PackageCacheNamespace } from '../../util/cache/package/types.ts';
import { withCache } from '../../util/cache/package/with-cache.ts';
import { Datasource } from './datasource.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  GitHostTag,
  ReleaseResult,
} from './types.ts';

/**
 * Base class for the `*-tags` datasources of git hosting providers.
 *
 * It owns the package cache wrappers and the `<registryUrl>:<repo>:<type>`
 * cache key convention shared by all of them, so that subclasses only have to
 * implement the provider specific API calls.
 *
 * Subclasses that also support digest lookups should extend
 * {@link GitHostTagsDigestDatasource} instead.
 */
export abstract class GitHostTagsDatasource extends Datasource {
  protected abstract readonly cacheNamespace: PackageCacheNamespace;

  /**
   * Normalizes the registry URL, applying the datasource default and stripping
   * any API path suffix.
   */
  abstract getRegistryUrl(registryUrl?: string): string;

  /** Browser URL of the repository. */
  abstract getSourceUrl(packageName: string, registryUrl?: string): string;

  /** Fetches the tags of the repository. */
  protected abstract fetchTags(
    config: GetReleasesConfig,
  ): Promise<GitHostTag[] | null>;

  getCacheKey(
    registryUrl: string | undefined,
    repo: string,
    type: string,
  ): string {
    return `${this.getRegistryUrl(registryUrl)}:${repo}:${type}`;
  }

  override getReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: this.getCacheKey(config.registryUrl, config.packageName, 'tags'),
        fallback: true,
      },
      () => this.fetchReleases(config),
    );
  }

  protected async fetchReleases(
    config: GetReleasesConfig,
  ): Promise<ReleaseResult | null> {
    const { packageName, registryUrl } = config;

    const tags = await this.fetchTags(config);
    if (!tags) {
      return null;
    }

    return {
      sourceUrl: this.getSourceUrl(packageName, registryUrl),
      registryUrl: this.getRegistryUrl(registryUrl),
      releases: tags.map((tag) => ({ ...tag, gitRef: tag.version })),
    };
  }
}

/**
 * Base class for the `*-tags` datasources of git hosting providers which also
 * resolve digests: the commit of the given tag, or the latest commit of the
 * default branch when no tag is given.
 */
export abstract class GitHostTagsDigestDatasource extends GitHostTagsDatasource {
  /** Fetches the commit hash the given tag points at. */
  protected abstract fetchTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null>;

  /** Fetches the latest commit of the repository default branch. */
  protected abstract fetchLatestCommit(
    registryUrl: string | undefined,
    repo: string,
  ): Promise<string | null>;

  getTagCommit(
    registryUrl: string | undefined,
    repo: string,
    tag: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: this.getCacheKey(registryUrl, repo, `tag-${tag}`),
      },
      () => this.fetchTagCommit(registryUrl, repo, tag),
    );
  }

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return withCache(
      {
        namespace: this.cacheNamespace,
        key: this.getCacheKey(config.registryUrl, config.packageName, 'digest'),
        fallback: true,
      },
      () => this.fetchDigest(config, newValue),
    );
  }

  protected fetchDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const { packageName: repo, registryUrl } = config;

    if (newValue?.length) {
      return this.getTagCommit(registryUrl, repo, newValue);
    }

    return this.fetchLatestCommit(registryUrl, repo);
  }
}
