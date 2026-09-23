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

export abstract class Datasource implements DatasourceApi {
  public readonly id: string;

  /**
   * The package cache namespace used by {@link Datasource.cached}.
   * Defaults to `datasource-<id>`, which must be registered in
   * `packageCacheNamespaces`.
   */
  protected readonly cacheNamespace: PackageCacheNamespace;

  protected constructor(id: string) {
    this.id = id;
    this.http = new Http(id);
    this.cacheNamespace = `datasource-${id}` as PackageCacheNamespace;
  }

  caching: boolean | undefined;

  customRegistrySupport = true;

  defaultConfig: Record<string, unknown> | undefined;

  defaultRegistryUrls?: string[] | (() => string[]);

  defaultVersioning?: string | undefined;

  registryStrategy: RegistryStrategy | undefined = 'first';

  releaseTimestampSupport = false;
  releaseTimestampNote?: string | undefined;

  sourceUrlSupport: SourceUrlSupport = 'none';
  sourceUrlNote?: string | undefined;

  protected http: Http;

  abstract getReleases(
    getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null>;

  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;

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

  // istanbul ignore next: no-op implementation, never called
  postprocessRelease(
    _config: PostprocessReleaseConfig,
    release: Release,
  ): Promise<PostprocessReleaseResult> {
    return Promise.resolve(release);
  }
}
