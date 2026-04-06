import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { isHttpUrl } from '../../../util/url.ts';
import * as hashicorpVersioning from '../../versioning/hashicorp/index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { TerraformDatasource } from './base.ts';
import {
  TerraformModuleResponse,
  TerraformModuleVersionsResponse,
} from './schema.ts';
import { createSDBackendURL, getRegistryRepository } from './utils.ts';

export class TerraformModuleDatasource extends TerraformDatasource {
  static override readonly id = 'terraform-module';

  static readonly terraformCloudUrl = 'https://app.terraform.io';

  static readonly defaultRegistryUrls = [
    TerraformModuleDatasource.terraformRegistryUrl,
  ];

  static readonly extendedApiRegistryUrls = [
    TerraformModuleDatasource.terraformRegistryUrl,
    TerraformModuleDatasource.terraformCloudUrl,
  ];

  constructor() {
    super(TerraformModuleDatasource.id);
  }

  override readonly defaultRegistryUrls =
    TerraformModuleDatasource.defaultRegistryUrls;

  override readonly defaultVersioning = hashicorpVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is only supported for the latest version, and is determined from the `published_at` field in the results.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the the `source` field in the results.';

  /**
   * Resolves a module release list for the configured registry.
   *
   * Requests against the public Terraform registry and Terraform Cloud use the
   * registry-specific module endpoint, while other registries use the generic
   * Module Registry Protocol versions endpoint.
   */
  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }

    const { registry, repository } = getRegistryRepository(
      packageName,
      registryUrl,
    );
    logger.trace(
      { registryUrlNormalized: registry, terraformRepository: repository },
      'terraform-module.getReleases()',
    );

    if (TerraformModuleDatasource.extendedApiRegistryUrls.includes(registry)) {
      return await this.queryTerraformRegistry(registry, repository);
    }

    // Use the standard Module Registry Protocol for other conformant registries.
    return await this.queryModuleRegistry(registry, repository);
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${TerraformModuleDatasource.id}`,
        key: TerraformModuleDatasource.getCacheKey(config),
        fallback: true,
      },
      () =>
        this._getReleases(config).catch((err: Error) =>
          this.handleGenericErrors(err),
        ),
    );
  }

  /**
   * Queries the Terraform Registry module endpoint.
   *
   * The response includes the latest published version separately, so only that
   * release can be annotated with `releaseTimestamp`.
   *
   * https://developer.hashicorp.com/terraform/registry/api-docs#get-a-specific-module
   */
  private async queryTerraformRegistry(
    registryUrl: string,
    repository: string,
  ): Promise<ReleaseResult> {
    const serviceDiscovery =
      await this.getTerraformServiceDiscoveryResult(registryUrl);
    const pkgUrl = createSDBackendURL(
      registryUrl,
      'modules.v1',
      serviceDiscovery,
      repository,
    );
    const { body: res } = await this.http.getJson(
      pkgUrl,
      TerraformModuleResponse,
    );
    return {
      releases: res.versions,
      sourceUrl: res.source,
      homepage: `${registryUrl}/modules/${repository}`,
    };
  }

  /**
   * Queries a registry through the Terraform Module Registry Protocol.
   *
   * This is the default path for registries implementing the standard module
   * registry protocol. It returns release versions and, when present and valid,
   * the upstream source URL.
   *
   * https://developer.hashicorp.com/terraform/internals/module-registry-protocol
   */
  private async queryModuleRegistry(
    registryUrl: string,
    repository: string,
  ): Promise<ReleaseResult | null> {
    const serviceDiscovery =
      await this.getTerraformServiceDiscoveryResult(registryUrl);
    const pkgUrl = createSDBackendURL(
      registryUrl,
      'modules.v1',
      serviceDiscovery,
      `${repository}/versions`,
    );
    const { body: res } = await this.http.getJson(
      pkgUrl,
      TerraformModuleVersionsResponse,
    );
    return {
      releases: res.versions,
      sourceUrl: isHttpUrl(res.source) ? res.source : undefined,
    };
  }

  private static getCacheKey({
    packageName,
    registryUrl,
  }: GetReleasesConfig): string {
    const { registry, repository } = getRegistryRepository(
      packageName,
      registryUrl,
    );
    return `${registry}/${repository}`;
  }
}
