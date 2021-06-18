import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { parseUrl } from '../../util/url';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import { Datasource } from '../datasource';
import { TerraformModuleDatasource } from '../terraform-module';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type {
  TerraformProvider,
  TerraformProviderReleaseBackend,
} from './types';

export class TerraformProviderDatasource extends Datasource {
  static readonly id = 'terraform-provider';

  static readonly defaultRegistryUrls = [
    'https://registry.terraform.io',
    'https://releases.hashicorp.com',
  ];

  constructor() {
    super(TerraformProviderDatasource.id);
  }

  readonly defaultRegistryUrls =
    TerraformProviderDatasource.defaultRegistryUrls;

  readonly defaultVersioning = hashicorpVersioning.id;

  readonly registryStrategy = 'hunt';

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}`,
    key: (getReleasesConfig: GetReleasesConfig) =>
      `${
        getReleasesConfig.registryUrl
      }/${TerraformProviderDatasource.getRepository(getReleasesConfig)}`,
  })
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
    let dep: ReleaseResult = null;
    const registryHost = parseUrl(registryUrl).host;
    if (registryHost === 'releases.hashicorp.com') {
      dep = await this.queryReleaseBackend(lookupName, registryUrl);
    } else {
      const repository = TerraformProviderDatasource.getRepository({
        lookupName,
      });
      dep = await this.queryRegistry(registryUrl, repository);
    }

    return dep;
  }

  private static getRepository({ lookupName }: GetReleasesConfig): string {
    return lookupName.includes('/') ? lookupName : `hashicorp/${lookupName}`;
  }

  private async queryRegistry(
    registryURL: string,
    repository: string
  ): Promise<ReleaseResult> {
    const serviceDiscovery =
      await new TerraformModuleDatasource().getTerraformServiceDiscoveryResult(
        registryURL
      );
    const backendURL = `${registryURL}${serviceDiscovery['providers.v1']}${repository}`;
    const res = (await this.http.getJson<TerraformProvider>(backendURL)).body;
    const dep: ReleaseResult = {
      releases: null,
    };
    if (res.source) {
      dep.sourceUrl = res.source;
    }
    dep.releases = res.versions.map((version) => ({
      version,
    }));
    // set published date for latest release
    const latestVersion = dep.releases.find(
      (release) => res.version === release.version
    );
    // istanbul ignore else
    if (latestVersion) {
      latestVersion.releaseTimestamp = res.published_at;
    }
    dep.homepage = `${registryURL}/providers/${repository}`;
    logger.trace({ dep }, 'dep');
    return dep;
  }

  // TODO: add long term cache (#9590)
  private async queryReleaseBackend(
    lookupName: string,
    registryURL: string
  ): Promise<ReleaseResult> {
    const backendLookUpName = `terraform-provider-${lookupName}`;
    const backendURL = registryURL + `/index.json`;
    const res = (
      await this.http.getJson<TerraformProviderReleaseBackend>(backendURL)
    ).body;

    if (!res[backendLookUpName]) {
      return null;
    }

    const dep: ReleaseResult = {
      releases: null,
      sourceUrl: `https://github.com/terraform-providers/${backendLookUpName}`,
    };
    dep.releases = Object.keys(res[backendLookUpName].versions).map(
      (version) => ({
        version,
      })
    );
    logger.trace({ dep }, 'dep');
    return dep;
  }
}
