import { logger } from '../../../logger';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { coerceString } from '../../../util/string';
import { asTimestamp } from '../../../util/timestamp';
import { isHttpUrl } from '../../../util/url';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { TerraformDatasource } from './base';
import type {
  RegistryRepository,
  ServiceDiscoveryResult,
  TerraformModuleVersions,
  TerraformRelease,
} from './types';
import { createSDBackendURL } from './utils';

export class TerraformModuleDatasource extends TerraformDatasource {
  static override readonly id = 'terraform-module';

  constructor() {
    super(TerraformModuleDatasource.id);
  }

  override readonly defaultRegistryUrls = ['https://registry.terraform.io'];

  override readonly defaultVersioning = hashicorpVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is only supported for the latest version, and is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the the `source` field in the results.';

  readonly extendedApiRegistryUrls = [
    'https://registry.terraform.io',
    'https://app.terraform.io',
  ];

  /**
   * This function will fetch a package from the specified Terraform registry and return all semver versions.
   *  - `sourceUrl` is supported if "source" field is set
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

    const { registry: registryUrlNormalized, repository } =
      TerraformModuleDatasource.getRegistryRepository(packageName, registryUrl);
    logger.trace(
      { registryUrlNormalized, terraformRepository: repository },
      'terraform-module.getReleases()',
    );

    const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(
      registryUrlNormalized,
    );
    if (this.extendedApiRegistryUrls.includes(registryUrlNormalized)) {
      return await this.queryRegistryExtendedApi(
        serviceDiscovery,
        registryUrlNormalized,
        repository,
      );
    }

    return await this.queryRegistryVersions(
      serviceDiscovery,
      registryUrlNormalized,
      repository,
    );
  }

  /**
   * this uses the api that terraform registry has in addition to the base api
   * this endpoint provides more information, such as release date
   * https://www.terraform.io/registry/api-docs#latest-version-for-a-specific-module-provider
   */
  private async queryRegistryExtendedApi(
    serviceDiscovery: ServiceDiscoveryResult,
    registryUrl: string,
    repository: string,
  ): Promise<ReleaseResult | null> {
    let res: TerraformRelease;
    let pkgUrl: string;

    try {
      // TODO: types (#22198)

      pkgUrl = createSDBackendURL(
        registryUrl,
        'modules.v1',
        serviceDiscovery,
        repository,
      );
      res = (await this.http.getJsonUnchecked<TerraformRelease>(pkgUrl)).body;
      const returnedName = res.namespace + '/' + res.name + '/' + res.provider;
      if (returnedName !== repository) {
        logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
        return null;
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
    dep.homepage = `${registryUrl}/modules/${repository}`;
    // set published date for latest release
    const latestVersion = dep.releases.find(
      (release) => res.version === release.version,
    );
    if (latestVersion) {
      latestVersion.releaseTimestamp = asTimestamp(res.published_at);
    }
    return dep;
  }

  /**
   * this version uses the Module Registry Protocol that all registries are required to implement
   * https://www.terraform.io/internals/module-registry-protocol
   */
  private async queryRegistryVersions(
    serviceDiscovery: ServiceDiscoveryResult,
    registryUrl: string,
    repository: string,
  ): Promise<ReleaseResult | null> {
    let res: TerraformModuleVersions;
    let pkgUrl: string;
    try {
      // TODO: types (#22198)
      pkgUrl = createSDBackendURL(
        registryUrl,
        'modules.v1',
        serviceDiscovery,
        `${repository}/versions`,
      );
      res = (await this.http.getJsonUnchecked<TerraformModuleVersions>(pkgUrl))
        .body;
      if (res.modules.length < 1) {
        logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
        return null;
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

    // Add the source URL if given
    if (isHttpUrl(res.modules[0].source)) {
      dep.sourceUrl = res.modules[0].source;
    }

    return dep;
  }

  private static getRegistryRepository(
    packageName: string,
    registryUrl: string | undefined,
  ): RegistryRepository {
    let registry: string;
    const split = packageName.split('/');
    if (split.length > 3 && split[0].includes('.')) {
      [registry] = split;
      split.shift();
    } else {
      registry = coerceString(registryUrl);
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
