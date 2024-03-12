// TODO: types (#22198)
import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import * as p from '../../../util/promises';
import { regEx } from '../../../util/regex';
import { joinUrlParts } from '../../../util/url';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import { TerraformDatasource } from '../terraform-module/base';
import type { ServiceDiscoveryResult } from '../terraform-module/types';
import { createSDBackendURL } from '../terraform-module/utils';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type {
  TerraformBuild,
  TerraformProvider,
  TerraformProviderReleaseBackend,
  TerraformProviderVersions,
  TerraformRegistryBuildResponse,
  TerraformRegistryVersions,
  VersionDetailResponse,
} from './types';

export class TerraformProviderDatasource extends TerraformDatasource {
  static override readonly id = 'terraform-provider';

  static readonly defaultRegistryUrls = [
    'https://registry.terraform.io',
    'https://releases.hashicorp.com',
  ];

  static repositoryRegex = regEx(/^hashicorp\/(?<packageName>\S+)$/);

  constructor() {
    super(TerraformProviderDatasource.id);
  }

  override readonly defaultRegistryUrls =
    TerraformProviderDatasource.defaultRegistryUrls;

  override readonly defaultVersioning = hashicorpVersioning.id;

  override readonly registryStrategy = 'hunt';

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}`,
    key: (getReleasesConfig: GetReleasesConfig) =>
      `${
        getReleasesConfig.registryUrl
      }/${TerraformProviderDatasource.getRepository(getReleasesConfig)}`,
  })
  async getReleases({
    packageName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    // istanbul ignore if
    if (!registryUrl) {
      return null;
    }
    logger.trace(
      `terraform-provider.getDependencies() packageName: ${packageName}`,
    );

    if (registryUrl === this.defaultRegistryUrls[1]) {
      return await this.queryReleaseBackend(packageName, registryUrl);
    }
    const repository = TerraformProviderDatasource.getRepository({
      packageName,
    });
    const serviceDiscovery =
      await this.getTerraformServiceDiscoveryResult(registryUrl);

    if (registryUrl === this.defaultRegistryUrls[0]) {
      return await this.queryRegistryExtendedApi(
        serviceDiscovery,
        registryUrl,
        repository,
      );
    }

    return await this.queryRegistryVersions(
      serviceDiscovery,
      registryUrl,
      repository,
    );
  }

  private static getRepository({ packageName }: GetReleasesConfig): string {
    return packageName.includes('/') ? packageName : `hashicorp/${packageName}`;
  }

  /**
   * this uses the api that terraform registry has in addition to the base api
   * this endpoint provides more information, such as release date
   * this api is undocumented.
   */
  private async queryRegistryExtendedApi(
    serviceDiscovery: ServiceDiscoveryResult,
    registryUrl: string,
    repository: string,
  ): Promise<ReleaseResult> {
    const backendURL = createSDBackendURL(
      registryUrl,
      'providers.v1',
      serviceDiscovery,
      repository,
    );
    const res = (await this.http.getJson<TerraformProvider>(backendURL)).body;
    const dep: ReleaseResult = {
      releases: res.versions.map((version) => ({
        version,
      })),
    };
    if (res.source) {
      dep.sourceUrl = res.source;
    }
    // set published date for latest release
    const latestVersion = dep.releases.find(
      (release) => res.version === release.version,
    );
    // istanbul ignore else
    if (latestVersion) {
      latestVersion.releaseTimestamp = res.published_at;
    }
    dep.homepage = `${registryUrl}/providers/${repository}`;
    return dep;
  }

  /**
   * this version uses the Provider Registry Protocol that all registries are required to implement
   * https://www.terraform.io/internals/provider-registry-protocol
   */
  private async queryRegistryVersions(
    serviceDiscovery: ServiceDiscoveryResult,
    registryUrl: string,
    repository: string,
  ): Promise<ReleaseResult> {
    const backendURL = createSDBackendURL(
      registryUrl,
      'providers.v1',
      serviceDiscovery,
      `${repository}/versions`,
    );
    const res = (await this.http.getJson<TerraformProviderVersions>(backendURL))
      .body;
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
      await this.http.getJson<TerraformProviderReleaseBackend>(backendURL)
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

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}-builds`,
    key: (registryURL: string, repository: string, version: string) =>
      `${registryURL}/${repository}/${version}`,
  })
  async getBuilds(
    registryURL: string,
    repository: string,
    version: string,
  ): Promise<TerraformBuild[] | null> {
    if (registryURL === TerraformProviderDatasource.defaultRegistryUrls[1]) {
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
        /* istanbul ignore next */
        if (err instanceof ExternalHostError) {
          throw err;
        }
        logger.debug(
          { err, backendLookUpName, version },
          `Failed to retrieve builds for ${backendLookUpName} ${version}`,
        );
        return null;
      }
      return versionReleaseBackend.builds;
    }

    // check public or private Terraform registry
    const serviceDiscovery =
      await this.getTerraformServiceDiscoveryResult(registryURL);
    if (!serviceDiscovery) {
      logger.trace(`Failed to retrieve service discovery from ${registryURL}`);
      return null;
    }
    const backendURL = createSDBackendURL(
      registryURL,
      'providers.v1',
      serviceDiscovery,
      repository,
    );
    const versionsResponse = (
      await this.http.getJson<TerraformRegistryVersions>(
        `${backendURL}/versions`,
      )
    ).body;
    if (!versionsResponse.versions) {
      logger.trace(`Failed to retrieve version list for ${backendURL}`);
      return null;
    }
    const builds = versionsResponse.versions.find(
      (value) => value.version === version,
    );
    if (!builds) {
      logger.trace(
        `No builds found for ${repository}:${version} on ${registryURL}`,
      );
      return null;
    }
    const result = await p.map(
      builds.platforms,
      async (platform) => {
        const buildURL = `${backendURL}/${version}/download/${platform.os}/${platform.arch}`;
        try {
          const res = (
            await this.http.getJson<TerraformRegistryBuildResponse>(buildURL)
          ).body;
          const newBuild: TerraformBuild = {
            name: repository,
            url: res.download_url,
            version,
            ...res,
          };
          return newBuild;
        } catch (err) {
          /* istanbul ignore next */
          if (err instanceof ExternalHostError) {
            throw err;
          }
          logger.debug({ err, url: buildURL }, 'Failed to retrieve build');
          return null;
        }
      },
      { concurrency: 4 },
    );

    const filteredResult = result.filter(is.truthy);
    return filteredResult.length === result.length ? filteredResult : null;
  }

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}-zip-hashes`,
    key: (zipHashUrl: string) => zipHashUrl,
  })
  async getZipHashes(zipHashUrl: string): Promise<string[] | undefined> {
    // The hashes are formatted as the result of sha256sum in plain text, each line: <hash>\t<filename>
    let rawHashData: string;
    try {
      rawHashData = (await this.http.get(zipHashUrl)).body;
    } catch (err) {
      /* istanbul ignore next */
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

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}-releaseBackendIndex`,
    key: (backendLookUpName: string, version: string) =>
      `${backendLookUpName}/${version}`,
  })
  async getReleaseBackendIndex(
    backendLookUpName: string,
    version: string,
  ): Promise<VersionDetailResponse> {
    return (
      await this.http.getJson<VersionDetailResponse>(
        `${TerraformProviderDatasource.defaultRegistryUrls[1]}/${backendLookUpName}/${version}/index.json`,
      )
    ).body;
  }
}
