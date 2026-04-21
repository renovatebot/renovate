import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import type { HttpError } from '../../../util/http/index.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import { ServiceDiscoveryResponse } from './schema.ts';

const terraformId = 'terraform';

// TODO: extract to a separate directory structure (#10532)
export abstract class TerraformDatasource extends Datasource {
  static id = terraformId;

  static readonly terraformRegistryUrl = 'https://registry.terraform.io';

  private async _getTerraformServiceDiscoveryResult(
    registryUrl: string,
  ): Promise<ServiceDiscoveryResponse> {
    const discoveryURL = TerraformDatasource.getDiscoveryUrl(registryUrl);
    const { body: res } = await this.http.getJson(
      discoveryURL,
      ServiceDiscoveryResponse,
    );
    return res;
  }

  getTerraformServiceDiscoveryResult(
    registryUrl: string,
  ): Promise<ServiceDiscoveryResponse> {
    return withCache(
      {
        namespace: `datasource-${terraformId}`,
        key: TerraformDatasource.getDiscoveryUrl(registryUrl),
        ttlMinutes: 1440,
      },
      () => this._getTerraformServiceDiscoveryResult(registryUrl),
    );
  }

  private static getDiscoveryUrl(registryUrl: string): string {
    return `${ensureTrailingSlash(registryUrl)}.well-known/terraform.json`;
  }

  override handleHttpErrors(err: HttpError): void {
    const failureCodes = ['EAI_AGAIN'];
    if (failureCodes.includes(err.code)) {
      throw new ExternalHostError(err);
    }
    if (err.response?.statusCode === 503) {
      throw new ExternalHostError(err);
    }
  }
}
