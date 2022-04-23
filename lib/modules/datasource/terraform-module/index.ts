import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { TerraformDatasource } from './base';
import type {
  RegistryRepository,
  ServiceDiscoveryResult,
  TerraformModuleVersions,
  TerraformRelease,
} from './types';

export class TerraformModuleDatasource extends TerraformDatasource {
  static override readonly id = 'terraform-module';

  constructor() {
    super(TerraformModuleDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://registry.terraform.io'];

  override readonly defaultVersioning = hashicorpVersioning.id;

  /**
   * This function will fetch a package from the specified Terraform registry and return all semver versions.
   *  - `sourceUrl` is supported of "source" field is set
   *  - `homepage` is set to the Terraform registry's page if it's on the official main registry
   */
  @cache({
    namespace: `datasource-${TerraformModuleDatasource.id}`,
    key: (getReleasesConfig: GetReleasesConfig) =>
      TerraformModuleDatasource.getCacheKey(getReleasesConfig),
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }

    const { registry, repository } =
      TerraformModuleDatasource.getRegistryRepository(packageName, registryUrl);
    logger.trace(
      { registry, terraformRepository: repository },
      'terraform-module.getReleases()'
    );

    const dep = await this.queryRegistry(registryUrl, registry, repository);

    logger.trace({ dep }, 'dep');
    return dep;
  }

  private async queryRegistry(
    registryUrl: string,
    registry: string,
    repository: string
  ): Promise<ReleaseResult> {
    const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(
      registryUrl
    );
    const registryHost = parseUrl(registryUrl)?.host;
    if (registryHost === 'registry.terraform.io') {
      return await this.queryRegistryExtendedApi(
        serviceDiscovery,
        registry,
        repository
      );
    } else {
      return await this.queryRegistryVersions(
        serviceDiscovery,
        registry,
        repository
      );
    }
  }

  /**
   * this uses the api that terraform registry has in addition to the base api
   * this endpoint provides more information, such as release date
   * https://www.terraform.io/registry/api-docs#latest-version-for-a-specific-module-provider
   */
  private async queryRegistryExtendedApi(
    serviceDiscovery: ServiceDiscoveryResult,
    registry: string,
    repository: string
  ): Promise<ReleaseResult> {
    let res: TerraformRelease;
    let pkgUrl: string;

    try {
      pkgUrl = `${registry}${serviceDiscovery['modules.v1']}${repository}`;
      res = (await this.http.getJson<TerraformRelease>(pkgUrl)).body;
      const returnedName = res.namespace + '/' + res.name + '/' + res.provider;
      if (returnedName !== repository) {
        logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
        throw new Error('Terraform registry result mismatch');
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }

    // Simplify response before caching and returning
    const dep: ReleaseResult = {
      releases: res.versions.map((version) => ({
        version,
      })),
    };
    if (res.source) {
      dep.sourceUrl = res.source;
    }
    if (pkgUrl.startsWith('https://registry.terraform.io/')) {
      dep.homepage = `https://registry.terraform.io/modules/${repository}`;
    }
    // set published date for latest release
    const latestVersion = dep.releases.find(
      (release) => res.version === release.version
    );
    if (latestVersion) {
      latestVersion.releaseTimestamp = res.published_at;
    }
    return dep;
  }

  /**
   * this version uses the Module Registry Protocol that all registries are required to implement
   * https://www.terraform.io/internals/module-registry-protocol
   */
  private async queryRegistryVersions(
    serviceDiscovery: ServiceDiscoveryResult,
    registry: string,
    repository: string
  ): Promise<ReleaseResult> {
    let res: TerraformModuleVersions;
    let pkgUrl: string;
    try {
      pkgUrl = `${registry}${serviceDiscovery['modules.v1']}${repository}/versions`;
      res = (await this.http.getJson<TerraformModuleVersions>(pkgUrl)).body;
      if (res.modules.length < 1) {
        logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
        throw new Error('Terraform registry result mismatch');
      }
    } catch (err) {
      this.handleGenericErrors(err);
    }

    // Simplify response before caching and returning
    const dep: ReleaseResult = {
      releases: res.modules[0].versions.map(({ version }) => ({
        version,
      })),
    };
    if (res.modules[0].source) {
      dep.sourceUrl = res.modules[0].source;
    }
    if (pkgUrl.startsWith('https://registry.terraform.io/')) {
      dep.homepage = `https://registry.terraform.io/modules/${repository}`;
    }
    return dep;
  }

  private static getRegistryRepository(
    packageName: string,
    registryUrl = ''
  ): RegistryRepository {
    let registry: string;
    const split = packageName.split('/');
    if (split.length > 3 && split[0].includes('.')) {
      [registry] = split;
      split.shift();
    } else {
      registry = registryUrl;
    }
    if (!regEx(/^https?:\/\//).test(registry)) {
      registry = `https://${registry}`;
    }
    const repository = split.join('/');
    return {
      registry,
      repository,
    };
  }

  private static getCacheKey({
    packageName,
    registryUrl,
  }: GetReleasesConfig): string {
    const { registry, repository } =
      TerraformModuleDatasource.getRegistryRepository(packageName, registryUrl);
    return `${registry}/${repository}`;
  }
}
