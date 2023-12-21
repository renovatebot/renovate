import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http, HttpError } from '../../util/http';
import type {
  DatasourceApi,
  DigestConfig,
  GetReleasesConfig,
  RegistryStrategy,
  ReleaseResult,
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

  protected http: Http;

  abstract getReleases(
    getReleasesConfig: GetReleasesConfig,
  ): Promise<ReleaseResult | null>;

  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;

  handleHttpErrors(err: HttpError): void {}

  protected handleGenericErrors(err: Error): never {
    // istanbul ignore if: not easy testable with nock
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
}
