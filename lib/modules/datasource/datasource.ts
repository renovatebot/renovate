import { S3 } from "@aws-sdk/client-s3";
import { ExternalHostError } from '../../types/errors/external-host-error';
import { Http } from '../../util/http';
import type { HttpError } from '../../util/http';
import type {
  DatasourceApi,
  DigestConfig,
  GetReleasesConfig,
  ReleaseResult,
} from './types';

export abstract class Datasource implements DatasourceApi {
  protected constructor(public readonly id: string) {
    this.http = new Http(id);
    this.s3 = new S3({});
  }

  caching: boolean | undefined;

  customRegistrySupport = true;

  defaultConfig: Record<string, unknown> | undefined;

  defaultRegistryUrls: string[] | undefined;

  defaultVersioning: string | undefined;

  registryStrategy: 'first' | 'hunt' | 'merge' | undefined = 'first';

  protected http: Http;
  protected s3: S3;

  abstract getReleases(
    getReleasesConfig: GetReleasesConfig
  ): Promise<ReleaseResult | null>;

  getDigest?(config: DigestConfig, newValue?: string): Promise<string | null>;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handleSpecificErrors(err: HttpError): void {}

  protected handleGenericErrors(err: HttpError): never {
    // istanbul ignore if: not easy testable with nock
    if (err instanceof ExternalHostError) {
      throw err;
    }
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
