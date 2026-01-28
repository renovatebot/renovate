import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { cache } from '../../../util/cache/package/decorator.ts';
import type { HttpError } from '../../../util/http/index.ts';
import { ensureTrailingSlash } from '../../../util/url.ts';
import { Datasource } from '../datasource.ts';
import type { ServiceDiscoveryResult } from './types.ts';

const terraformId = 'terraform';

// TODO: extract to a separate directory structure (#10532)
export abstract class TerraformDatasource extends Datasource {
  static id = terraformId;

  @cache({
    namespace: `datasource-${terraformId}`,
    key: (registryUrl: string) =>
      TerraformDatasource.getDiscoveryUrl(registryUrl),
    ttlMinutes: 1440,
  })
  async getTerraformServiceDiscoveryResult(
    registryUrl: string,
  ): Promise<ServiceDiscoveryResult> {
    const discoveryURL = TerraformDatasource.getDiscoveryUrl(registryUrl);
    const serviceDiscovery = (
      await this.http.getJsonUnchecked<ServiceDiscoveryResult>(discoveryURL)
    ).body;
    return serviceDiscovery;
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
