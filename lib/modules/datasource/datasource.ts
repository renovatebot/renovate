import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http, HttpError } from '../../util/http';
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
} from './types';

export abstract class Datasource implements DatasourceApi {
  protected constructor(public readonly id: string) {
    this.http = new Http(id);
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

  protected handleGenericErrors(err: Error): never {
    if (err instanceof ExternalHostError) {
      throw err;
    }

    if (err instanceof HttpError) {
      this.handleHttpErrors(err);

      const statusCode = err.response?.statusCode;
      if (statusCode) {
        if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
          throw new ExternalHostError(err);
        }
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
