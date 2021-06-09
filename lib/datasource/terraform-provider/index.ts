import { logger } from '../../logger';
import { cache } from '../../util/cache/package/decorator';
import { parseUrl } from '../../util/url';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import { Datasource } from '../datasource';
import { getTerraformServiceDiscoveryResult } from '../terraform-module';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type {
  TerraformProvider,
  TerraformProviderReleaseBackend,
} from './types';

export class TerraformProviderDatasource extends Datasource {
  static readonly id = 'terraform-provider';

  constructor() {
    super(TerraformProviderDatasource.id);
  }

  readonly defaultRegistryUrls = [
    'https://registry.terraform.io',
    'https://releases.hashicorp.com',
  ];

  readonly defaultVersioning = hashicorpVersioning.id;

  readonly registryStrategy = 'hunt';

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}`,
    key: (getReleasesConfig: GetReleasesConfig) =>
      `${getReleasesConfig.registryUrl}/${
        getReleasesConfig.lookupName.includes('/')
          ? getReleasesConfig.lookupName
          : `hashicorp/${getReleasesConfig.lookupName}`
      }`,
  })
  async getReleases({
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const repository = lookupName.includes('/')
      ? lookupName
      : `hashicorp/${lookupName}`;

    logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
    let dep: ReleaseResult = null;
    const registryHost = parseUrl(registryUrl).host;
    if (registryHost === 'releases.hashicorp.com') {
      dep = await this.queryReleaseBackend(lookupName, registryUrl);
    } else {
      dep = await this.queryRegistry(registryUrl, repository);
    }

    return dep;
  }

  private async queryRegistry(
    registryURL: string,
    repository: string
  ): Promise<ReleaseResult> {
    const serviceDiscovery = await getTerraformServiceDiscoveryResult(
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
