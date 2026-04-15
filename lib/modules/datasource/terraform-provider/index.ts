// TODO: types (#22198)
import { logger } from '../../../logger/index.ts';
import { ExternalHostError } from '../../../types/errors/external-host-error.ts';
import { withCache } from '../../../util/cache/package/with-cache.ts';
import * as p from '../../../util/promises.ts';
import { regEx } from '../../../util/regex.ts';
import { getQueryString, joinUrlParts } from '../../../util/url.ts';
import * as hashicorpVersioning from '../../versioning/hashicorp/index.ts';
import { TerraformDatasource } from '../terraform-module/base.ts';
import type { ServiceDiscoveryResult } from '../terraform-module/types.ts';
import { createSDBackendURL } from '../terraform-module/utils.ts';
import type { GetReleasesConfig, ReleaseResult } from '../types.ts';
import { TerraformProviderV2Response } from './schema.ts';
import type {
  TerraformBuild,
  TerraformProviderReleaseBackend,
  TerraformProviderVersions,
  TerraformRegistryBuildResponse,
  TerraformRegistryVersions,
  VersionDetailResponse,
} from './types.ts';

export class TerraformProviderDatasource extends TerraformDatasource {
  static override readonly id = 'terraform-provider';

  static readonly hashicorpReleaseUrl = 'https://releases.hashicorp.com';
  static readonly terraformRegistryUrl = 'https://registry.terraform.io';

  static readonly defaultRegistryUrls = [
    TerraformProviderDatasource.terraformRegistryUrl,
    TerraformProviderDatasource.hashicorpReleaseUrl,
  ];

  static repositoryRegex = regEx(/^hashicorp\/(?<packageName>\S+)$/);

  constructor() {
    super(TerraformProviderDatasource.id);
  }

  override readonly defaultRegistryUrls =
    TerraformProviderDatasource.defaultRegistryUrls;

  override readonly defaultVersioning = hashicorpVersioning.id;

  override readonly registryStrategy = 'hunt';

  override readonly releaseTimestampSupport = true;
  override readonly releaseTimestampNote =
    'The release timestamp is determined from the `published-at` field in the Terraform Registry v2 API response and is only available for `https://registry.terraform.io`.';
  override readonly sourceUrlSupport = 'package';
  override readonly sourceUrlNote =
    'The source URL is determined from the the `source` field in the results.';

  private async _getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    /* v8 ignore next 3 -- should never happen */
    if (!registryUrl) {
      return null;
    }
    logger.trace(
      `terraform-provider.getDependencies() packageName: ${packageName}`,
    );

    if (registryUrl === TerraformProviderDatasource.terraformRegistryUrl) {
      return await this.queryTerraformRegistryV2(registryUrl, packageName);
    }
    if (registryUrl === TerraformProviderDatasource.hashicorpReleaseUrl) {
      return await this.queryReleaseBackend(packageName, registryUrl);
    }

    // Fall back to the standard Provider Registry Protocol for other registries.
    return await this.queryProviderRegistry(registryUrl, packageName);
  }

  getReleases(config: GetReleasesConfig): Promise<ReleaseResult | null> {
    const url = config.registryUrl;
    const repo = TerraformProviderDatasource.getRepository(config);
    return withCache(
      {
        namespace: `datasource-${TerraformProviderDatasource.id}`,
        key: `getReleases:${url}/${repo}`,
        fallback: true,
      },
      () => this._getReleases(config),
    );
  }

  private static getRepository({ packageName }: GetReleasesConfig): string {
    return packageName.includes('/') ? packageName : `hashicorp/${packageName}`;
  }

  /**
   * Query the Terraform Registry using the undocumented v2 JSON:API.
   *
   * Returns release timestamps for all versions, unlike the v1 API
   * which only exposed the timestamp for the latest version.
   */
  private async queryTerraformRegistryV2(
    registryUrl: string,
    packageName: string,
  ): Promise<ReleaseResult> {
    const repository = TerraformProviderDatasource.getRepository({
      packageName,
    });
    const providerUrl = `${joinUrlParts(
      registryUrl,
      'v2/providers',
      repository,
    )}?${getQueryString({ include: 'provider-versions' })}`;
    const { body: res } = await this.http.getJson(
      providerUrl,
      TerraformProviderV2Response,
    );
    res.homepage = `${registryUrl}/providers/${repository}`;
    return res;
  }

  /**
   * Query a registry using the Provider Registry Protocol that all registries
   * are required to implement.
   * https://www.terraform.io/internals/provider-registry-protocol
   */
  private async queryProviderRegistry(
    registryUrl: string,
    packageName: string,
  ): Promise<ReleaseResult> {
    const repository = TerraformProviderDatasource.getRepository({
      packageName,
    });
    const serviceDiscovery: ServiceDiscoveryResult =
      await this.getTerraformServiceDiscoveryResult(registryUrl);
    const backendURL = createSDBackendURL(
      registryUrl,
      'providers.v1',
      serviceDiscovery,
      `${repository}/versions`,
    );
    const res = (
      await this.http.getJsonUnchecked<TerraformProviderVersions>(backendURL)
    ).body;
    const dep: ReleaseResult = {
      releases: res.versions.map(({ version }) => ({
        version,
      })),
    };
    return dep;
  }

  private async queryReleaseBackend(
    packageName: string,
    registryURL: string,
  ): Promise<ReleaseResult | null> {
    const hashicorpPackage = packageName.replace('hashicorp/', '');
    const backendLookUpName = `terraform-provider-${hashicorpPackage}`;
    const backendURL = joinUrlParts(
      registryURL,
      backendLookUpName,
      `index.json`,
    );
    const res = (
      await this.http.getJsonUnchecked<TerraformProviderReleaseBackend>(
        backendURL,
      )
    ).body;

    const dep: ReleaseResult = {
      releases: Object.keys(res.versions).map((version) => ({
        version,
      })),
      sourceUrl: joinUrlParts(
        'https://github.com/terraform-providers',
        backendLookUpName,
      ),
    };
    return dep;
  }

  private async _getBuilds(
    registryURL: string,
    repository: string,
    version: string,
  ): Promise<TerraformBuild[] | null> {
    if (registryURL === TerraformProviderDatasource.hashicorpReleaseUrl) {
      // check if registryURL === secondary backend
      const repositoryRegexResult =
        TerraformProviderDatasource.repositoryRegex.exec(repository)?.groups;
      if (!repositoryRegexResult) {
        // non hashicorp builds are not supported with releases.hashicorp.com
        return null;
      }
      const packageName = repositoryRegexResult.packageName;
      const backendLookUpName = `terraform-provider-${packageName}`;
      let versionReleaseBackend: VersionDetailResponse;
      try {
        versionReleaseBackend = await this.getReleaseBackendIndex(
          backendLookUpName,
          version,
        );
      } catch (err) {
        if (err instanceof ExternalHostError) {
          throw err;
        }
        logger.debug(
          { err, backendLookUpName, version },
          `Failed to retrieve builds for ${backendLookUpName} ${version}`,
        );
        // throw an error to disable caching
        throw new ExternalHostError(err);
      }
      return versionReleaseBackend.builds;
    }

    // check public or private Terraform registry
    const serviceDiscovery =
      await this.getTerraformServiceDiscoveryResult(registryURL);
    if (!serviceDiscovery) {
      // throw an error to disable caching
      throw new ExternalHostError(
        new Error(`Service discovery not found for ${registryURL}`),
      );
    }
    const backendURL = createSDBackendURL(
      registryURL,
      'providers.v1',
      serviceDiscovery,
      repository,
    );
    const versionsResponse = (
      await this.http.getJsonUnchecked<TerraformRegistryVersions>(
        `${backendURL}/versions`,
      )
    ).body;
    if (!versionsResponse.versions) {
      // throw an error to disable caching
      throw new ExternalHostError(
        new Error(`Failed to retrieve version list for ${backendURL}`),
      );
    }
    const builds = versionsResponse.versions.find(
      (value) => value.version === version,
    );
    if (!builds) {
      // should never happen, but just in case
      // throw an error to disable caching
      throw new ExternalHostError(
        new Error(
          `No builds found for ${repository}:${version} on ${registryURL}`,
        ),
      );
    }
    const result = await p.map(
      builds.platforms,
      async (platform) => {
        const buildURL = `${backendURL}/${version}/download/${platform.os}/${platform.arch}`;
        try {
          const res = (
            await this.http.getJsonUnchecked<TerraformRegistryBuildResponse>(
              buildURL,
            )
          ).body;
          const newBuild: TerraformBuild = {
            name: repository,
            url: res.download_url,
            version,
            ...res,
          };
          return newBuild;
        } catch (err) {
          /* v8 ignore next 3 -- hard to test */
          if (err instanceof ExternalHostError) {
            throw err;
          }
          logger.debug({ err, url: buildURL }, 'Failed to retrieve build');
          // throw an error to disable caching
          throw new ExternalHostError(err);
        }
      },
      { concurrency: 4 },
    );

    return result;
  }

  getBuilds(
    registryURL: string,
    repository: string,
    version: string,
  ): Promise<TerraformBuild[] | null> {
    return withCache(
      {
        namespace: `datasource-${TerraformProviderDatasource.id}`,
        key: `getBuilds:${registryURL}/${repository}/${version}`,
      },
      () => this._getBuilds(registryURL, repository, version),
    );
  }

  private async _getZipHashes(
    zipHashUrl: string,
  ): Promise<string[] | undefined> {
    // The hashes are formatted as the result of sha256sum in plain text, each line: <hash>\t<filename>
    let rawHashData: string;
    try {
      rawHashData = (await this.http.getText(zipHashUrl)).body;
    } catch (err) {
      /* v8 ignore next 3 -- hard to test */
      if (err instanceof ExternalHostError) {
        throw err;
      }
      logger.debug(
        { err, zipHashUrl },
        `Failed to retrieve zip hashes from ${zipHashUrl}`,
      );
      return undefined;
    }

    return rawHashData
      .trimEnd()
      .split('\n')
      .map((line) => line.split(/\s/)[0]);
  }

  getZipHashes(zipHashUrl: string): Promise<string[] | undefined> {
    return withCache(
      {
        namespace: `datasource-${TerraformProviderDatasource.id}`,
        key: `getZipHashes:${zipHashUrl}`,
      },
      () => this._getZipHashes(zipHashUrl),
    );
  }

  private async _getReleaseBackendIndex(
    backendLookUpName: string,
    version: string,
  ): Promise<VersionDetailResponse> {
    return (
      await this.http.getJsonUnchecked<VersionDetailResponse>(
        `${TerraformProviderDatasource.hashicorpReleaseUrl}/${backendLookUpName}/${version}/index.json`,
      )
    ).body;
  }

  getReleaseBackendIndex(
    backendLookUpName: string,
    version: string,
  ): Promise<VersionDetailResponse> {
    return withCache(
      {
        namespace: `datasource-${TerraformProviderDatasource.id}`,
        key: `getReleaseBackendIndex:${backendLookUpName}/${version}`,
      },
      () => this._getReleaseBackendIndex(backendLookUpName, version),
    );
  }
}
