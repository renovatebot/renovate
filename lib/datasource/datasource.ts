import { ExternalHostError } from '../types/errors/external-host-error';
import { Http } from '../util/http';
import type { HttpError } from '../util/http/types';
import type {
  DatasourceApi,
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from './types';

export abstract class Datasource implements DatasourceApi {
  protected constructor(public readonly id: string) {
    this.http = new Http(id);
  }

  caching: boolean | undefined;

  customRegistrySupport = true;

  defaultConfig: Record<string, unknown> | undefined;

  defaultRegistryUrls: string[] | undefined;

  defaultVersioning: string | undefined;

  registryStrategy: 'first' | 'hunt' | 'merge' | undefined = 'first';

  protected http: Http;

  abstract getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null>;

  getDigest?(config: DigestConfig, newValue?: string): Promise<string>;

  // eslint-disable-next-line class-methods-use-this
  handleSpecificErrors(err: HttpError): void {}

  protected handleGenericErrors(err: HttpError): never {
    this.handleSpecificErrors(err);
    if (err.response?.statusCode !== undefined) {
      if (
        err.response?.statusCode === 429 ||
        (err.response?.statusCode >= 500 && err.response?.statusCode < 600)
      ) {
        throw new ExternalHostError(err);
      }
    }
    throw err;
  }
}
