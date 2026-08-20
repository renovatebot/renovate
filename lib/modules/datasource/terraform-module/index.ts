import { logger } from '../../../logger/index.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import { getQueryString, isHttpUrl, joinUrlParts } from '../../../util/url.ts';
import * as hashicorpVersioning from '../../versioning/hashicorp/index.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { TerraformDatasource } from './base.ts';
import {
  OpenTofuModuleDocsResponse,
  ProtocolModuleResponse,
  TerraformModuleResponse,
  TerraformModuleV2Response,
} from './schema.ts';
import { createSDBackendURL, getRegistryRepository } from './utils.ts';

export class TerraformModuleDatasource extends TerraformDatasource {
  static override readonly id = 'terraform-module';

  static readonly terraformCloudUrl = 'https://app.terraform.io';

  static readonly defaultRegistryUrls = [
    TerraformModuleDatasource.terraformRegistryUrl,
  ];

  constructor() {
    super(TerraformModuleDatasource.id);
  }

  override readonly defaultRegistryUrls =
    TerraformModuleDatasource.defaultRegistryUrls;

  override readonly defaultVersioning = hashicorpVersioning.id;

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'For `registry.terraform.io` and `registry.opentofu.org` (via `api.opentofu.org`), release timestamps are available for all versions. For `app.terraform.io`, only the latest version is annotated, using the `published_at` field from the extended module endpoint.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'For `registry.terraform.io` and `app.terraform.io`, the source URL is taken from the `source` field of the registry response. For `registry.opentofu.org`, it is derived from the package name following the OpenTofu registry policy of `github.com/NAMESPACE/terraform-TARGETSYSTEM-NAME`.';

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

    try {
      if (registry === TerraformModuleDatasource.terraformRegistryUrl) {
        return await this.queryTerraformRegistryV2(registry, repository);
      }
      if (
        registry === TerraformModuleDatasource.openTofuRegistryUrl ||
        registry === TerraformModuleDatasource.openTofuApiUrl
      ) {
        return await this.queryOpenTofuRegistry(repository);
      }
      if (registry === TerraformModuleDatasource.terraformCloudUrl) {
        return await this.queryTerraformRegistry(registry, repository);
      }

      // Use the standard Module Registry Protocol for other conformant registries.
      return await this.queryModuleRegistry(registry, repository);
    } catch (err) {
      this.handleGenericErrors(err);
    }
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    return withCache(
      {
        namespace: `datasource-${TerraformModuleDatasource.id}`,
        key: TerraformModuleDatasource.getCacheKey(config),
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  /**
   * Query the Terraform Registry using the undocumented v2 JSON:API.
   *
   * Returns release timestamps for all versions, unlike the v1 extended
   * module endpoint which only exposed the timestamp for the latest version.
   */
  private async queryTerraformRegistryV2(
    registryUrl: string,
    repository: string,
  ): Promise<ReleaseResult> {
    const moduleUrl = `${joinUrlParts(
      registryUrl,
      'v2/modules',
      repository,
    )}?${getQueryString({ include: 'module-versions' })}`;
    const { body: res } = await this.http.getJson(
      moduleUrl,
      TerraformModuleV2Response,
    );
    res.homepage = `${registryUrl}/modules/${repository}`;
    return res;
  }

  /**
   * Query the OpenTofu registry docs API.
   * https://api.opentofu.org/
   *
   * Used when the registry URL is `registry.opentofu.org`.
   * Queries `api.opentofu.org` for module versions with release timestamps.
   */
  private async queryOpenTofuRegistry(
    repository: string,
  ): Promise<ReleaseResult> {
    const docsUrl = joinUrlParts(
      TerraformModuleDatasource.openTofuApiUrl,
      'registry/docs/modules',
      repository,
      'index.json',
    );
    const { body: res } = await this.http.getJson(
      docsUrl,
      OpenTofuModuleDocsResponse,
    );
    res.homepage = `https://search.opentofu.org/module/${repository}`;

    // The OpenTofu registry only indexes modules hosted on GitHub under the
    // `NAMESPACE/terraform-TARGETSYSTEM-NAME` repository naming convention, so
    // the source URL can be derived deterministically from the package name.
    // https://github.com/opentofu/registry/blob/main/PROCEDURES.md
    const [namespace, name, target] = repository.split('/');
    res.sourceUrl = `https://github.com/${namespace}/terraform-${target}-${name}`;

    return res;
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
      ProtocolModuleResponse,
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
