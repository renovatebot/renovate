import { buildCacheKey } from '../../util/cache/package/key.ts';
import type { Http } from '../../util/http/index.ts';
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
 * It owns the package cache wrappers and the `<registryUrl>:<repo>:<type>:<tag>`
 * cache key convention shared by all of them, so that subclasses only have to
 * implement the provider specific API calls.
 *
 * Subclasses that also support digest lookups should extend
 * {@link GitHostTagsDigestDatasource} instead.
 */
export abstract class GitHostTagsDatasource<
  H extends Http = Http,
> extends Datasource<H> {
  /**
   * The registry URL the lookups run against: `registryUrl`, or the first
   * default registry URL when none is configured. A subclass overrides it to
   * normalize the URL, for example to strip an API path suffix.
   */
  protected getRegistryUrl(registryUrl?: string): string {
    return registryUrl ?? this.getDefaultRegistryUrls('')![0];
  }

  /**
   * Browser URL of the repository `packageName` on `registryUrl`, or on the
   * default registry.
   */
  protected abstract getSourceUrl(
    packageName: string,
    registryUrl?: string,
  ): string;

  /** Fetches the tags of the repository. */
  protected abstract fetchTags(
    config: GetReleasesConfig,
  ): Promise<GitHostTag[] | null>;

  /**
   * Whether the lookups against `registryUrl` may be stored in the package
   * cache. `registryUrl` is always the URL returned by
   * {@link GitHostTagsDatasource.getRegistryUrl}.
   */
  protected isCacheable(_registryUrl: string): boolean {
    return true;
  }

  /**
   * Returns the result of `fn`, stored in the package cache under `key` when
   * {@link GitHostTagsDatasource.isCacheable} or `cachePrivatePackages` allows
   * it. A subclass whose API client caches the lookups itself overrides it to
   * call `fn` directly.
   */
  protected cachedLookup<T>(
    registryUrl: string | undefined,
    key: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const cacheable = this.isCacheable(this.getRegistryUrl(registryUrl));
    return this.cached({ key, fallback: true, cacheable }, fn);
  }

  protected getCacheKey(
    registryUrl: string | undefined,
    repo: string,
    type: string,
    tag?: string,
  ): string {
    return buildCacheKey(this.getRegistryUrl(registryUrl), repo, type, tag);
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return this.cachedLookup(
      config.registryUrl,
      this.getCacheKey(config.registryUrl, config.packageName, 'tags'),
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
export abstract class GitHostTagsDigestDatasource<
  H extends Http = Http,
> extends GitHostTagsDatasource<H> {
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

  override getDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    return this.cachedLookup(
      config.registryUrl,
      this.getCacheKey(
        config.registryUrl,
        config.packageName,
        'digest',
        newValue,
      ),
      () => this.fetchDigest(config, newValue),
    );
  }

  protected fetchDigest(
    config: DigestConfig,
    newValue?: string,
  ): Promise<string | null> {
    const { packageName: repo, registryUrl } = config;

    if (newValue?.length) {
      return this.fetchTagCommit(registryUrl, repo, newValue);
    }

    return this.fetchLatestCommit(registryUrl, repo);
  }
}
