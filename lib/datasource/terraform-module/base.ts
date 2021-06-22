import { cache } from '../../util/cache/package/decorator';
import { ensureTrailingSlash } from '../../util/url';
import { Datasource } from '../datasource';
import type { ServiceDiscoveryResult } from './types';

// TODO: extract to a separate directory structure (#10532)
export abstract class TerraformDatasource extends Datasource {
  static id = 'terraform';

  @cache({
    namespace: `datasource-${TerraformDatasource.id}`,
    key: (registryUrl: string) =>
      TerraformDatasource.getDiscoveryUrl(registryUrl),
    ttlMinutes: 1440,
  })
  async getTerraformServiceDiscoveryResult(
    registryUrl: string
  ): Promise<ServiceDiscoveryResult> {
    const discoveryURL = TerraformDatasource.getDiscoveryUrl(registryUrl);
    const serviceDiscovery = (
      await this.http.getJson<ServiceDiscoveryResult>(discoveryURL)
    ).body;
    return serviceDiscovery;
  }

  private static getDiscoveryUrl(registryUrl: string): string {
    return `${ensureTrailingSlash(registryUrl)}.well-known/terraform.json`;
  }
}
