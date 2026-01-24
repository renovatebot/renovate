import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cached } from '../../../util/cache/package/cached';
import type { HttpError } from '../../../util/http';
import { ensureTrailingSlash } from '../../../util/url';
import { Datasource } from '../datasource';
import type { ServiceDiscoveryResult } from './types';

const terraformId = 'terraform';

// TODO: extract to a separate directory structure (#10532)
export abstract class TerraformDatasource extends Datasource {
  static id = terraformId;

  private async _getTerraformServiceDiscoveryResult(
    registryUrl: string,
  ): Promise<ServiceDiscoveryResult> {
    const discoveryURL = TerraformDatasource.getDiscoveryUrl(registryUrl);
    const serviceDiscovery = (
      await this.http.getJsonUnchecked<ServiceDiscoveryResult>(discoveryURL)
    ).body;
    return serviceDiscovery;
  }

  getTerraformServiceDiscoveryResult(
    registryUrl: string,
  ): Promise<ServiceDiscoveryResult> {
    return cached(
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
    // istanbul ignore if
    if (failureCodes.includes(err.code)) {
      throw new ExternalHostError(err);
    }
    // istanbul ignore if
    if (err.response?.statusCode === 503) {
      throw new ExternalHostError(err);
    }
  }
}
