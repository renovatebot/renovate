import { ExternalHostError } from '../../types/errors/external-host-error.ts';
import type { NonEmptyArray } from '../../types/index.ts';
import type { PackageCacheNamespace } from '../../util/cache/package/types.ts';
import type { CachedOptions } from '../../util/cache/package/with-cache.ts';
import { withCache } from '../../util/cache/package/with-cache.ts';
import { Http, HttpError } from '../../util/http/index.ts';
import type {
  DigestConfig,
  GetReleasesConfig,
  PlainDatasourceApi,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  RegistryDatasourceApi,
  RegistryDigestConfig,
  RegistryGetReleasesConfig,
  RegistryStrategy,
  Release,
  ReleaseResult,
  SourceUrlSupport,
} from './types.ts';

/**
 * The part of a datasource that does not depend on whether it requires a
 * registry URL. Extend {@link Datasource} or {@link RegistryDatasource}
 * instead.
 */
abstract class DatasourceBase<H extends Http> {
  public readonly id: string;

  /**
   * The package cache namespace used by {@link DatasourceBase.cached}.
   * Defaults to `datasource-<id>`, which must be registered in
   * `packageCacheNamespaces`.
   */
  protected readonly cacheNamespace: PackageCacheNamespace;

  /**
   * A subclass that narrows `H` to a specialised client (`GithubHttp`,
   * `GitlabHttp`, ...) must construct that client itself and pass it as
   * `http`, since this constructor can only build the plain `Http` default.
   */
  protected constructor(id: string, http?: H) {
    this.id = id;
    this.http = http ?? (new Http(id) as H);
    this.cacheNamespace = `datasource-${id}` as PackageCacheNamespace;
  }

  caching: boolean | undefined;

  defaultConfig: Record<string, unknown> | undefined;

  supportsCustomRegistry(_packageName: string): boolean {
    return true;
  }

  defaultVersioning?: string | undefined;

  registryStrategy: RegistryStrategy = 'first';

  releaseTimestampSupport = false;
  releaseTimestampNote?: string | undefined;

  sourceUrlSupport: SourceUrlSupport = 'none';
  sourceUrlNote?: string | undefined;

  protected readonly http: H;

  postprocessRelease?(
    config: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult>;

  handleHttpErrors(_err: HttpError): void {
    // intentionally empty
  }

  /**
   * Caches the result of `fn` in the datasource cache namespace.
   *
   * Same as {@link withCache}, except that `namespace` defaults to
   * {@link DatasourceBase.cacheNamespace}.
   */
  protected cached<T>(
    options: Omit<CachedOptions, 'namespace'> & {
      namespace?: PackageCacheNamespace;
    },
    fn: () => T | Promise<T>,
  ): Promise<T> {
    return withCache(
      { ...options, namespace: options.namespace ?? this.cacheNamespace },
      fn,
    );
  }

  protected handleGenericErrors(err: Error): never {
    if (err instanceof ExternalHostError) {
      throw err;
    }

    if (err instanceof HttpError) {
      this.handleHttpErrors(err);

      const statusCode = err.response?.statusCode;
      if (
        statusCode &&
        (statusCode === 429 || (statusCode >= 500 && statusCode < 600))
      ) {
        throw new ExternalHostError(err);
      }
    }

    throw err;
  }
}

/**
 * A datasource that may be queried without a registry URL, so `registryUrl`
 * is optional in its `getReleases()` and `getDigest()` configs. Extend
 * {@link RegistryDatasource} instead if every package has a default registry.
 */
export abstract class Datasource<H extends Http = Http>
  extends DatasourceBase<H>
  implements PlainDatasourceApi
{
  readonly registryUrlRequired = false;

  getDefaultRegistryUrls(_packageName: string): string[] | undefined {
    return undefined;
  }

  abstract getReleases(
    getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null>;

  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;
}

/**
 * A datasource with a default registry for every package: the datasource
 * index always resolves a registry URL before calling `getReleases()` and
 * `getDigest()`.
 */
export abstract class RegistryDatasource<H extends Http = Http>
  extends DatasourceBase<H>
  implements RegistryDatasourceApi
{
  readonly registryUrlRequired = true;

  abstract getDefaultRegistryUrls(packageName: string): NonEmptyArray<string>;

  abstract getReleases(
    getReleasesConfig: RegistryGetReleasesConfig,
  ): Promise<ReleaseResult | null>;

  getDigest?(
    config: RegistryDigestConfig,
    newValue?: string,
  ): Promise<string | null>;
}
