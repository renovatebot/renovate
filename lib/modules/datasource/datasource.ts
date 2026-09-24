import { ExternalHostError } from '../../types/errors/external-host-error.ts';
import type { PackageCacheNamespace } from '../../util/cache/package/types.ts';
import type { CachedOptions } from '../../util/cache/package/with-cache.ts';
import { withCache } from '../../util/cache/package/with-cache.ts';
import { Http, HttpError } from '../../util/http/index.ts';
import type {
  DatasourceApi,
  DigestConfig,
  GetReleasesConfig,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  RegistryStrategy,
  Release,
  ReleaseResult,
  SourceUrlSupport,
} from './types.ts';

export abstract class Datasource<
  H extends Http = Http,
> implements DatasourceApi {
  public readonly id: string;

  /**
   * The package cache namespace used by {@link Datasource.cached}.
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

  getDefaultRegistryUrls(_packageName: string): string[] | undefined {
    return undefined;
  }

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

  /**
   * A datasource with a non-empty `defaultRegistryUrls` may declare its
   * parameter as `RegistryGetReleasesConfig`: TypeScript's method parameter
   * bivariance allows the narrower override, and the datasource index
   * guarantees the value.
   */
  abstract getReleases(
    getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null>;

  /**
   * A datasource with a non-empty `defaultRegistryUrls` may declare its
   * parameter as `RegistryDigestConfig`: TypeScript's method parameter
   * bivariance allows the narrower override, and the datasource index
   * guarantees the value.
   */
  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;

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
   * {@link Datasource.cacheNamespace}.
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
