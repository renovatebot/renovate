import is from '@sindresorhus/is';
import pMap from 'p-map';
import { logger } from '../../../logger';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import { cache } from '../../../util/cache/package/decorator';
import { regEx } from '../../../util/regex';
import { parseUrl } from '../../../util/url';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import { TerraformDatasource } from '../terraform-module/base';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import type {
  TerraformBuild,
  TerraformProvider,
  TerraformProviderReleaseBackend,
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
    logger.debug({ packageName }, 'terraform-provider.getDependencies()');
    let dep: ReleaseResult | null = null;
    const registryHost = parseUrl(registryUrl)?.host;
    if (registryHost === 'releases.hashicorp.com') {
      dep = await this.queryReleaseBackend(packageName, registryUrl);
    } else {
      const repository = TerraformProviderDatasource.getRepository({
        packageName,
      });
      dep = await this.queryRegistry(registryUrl, repository);
    }

    return dep;
  }

  private static getRepository({ packageName }: GetReleasesConfig): string {
    return packageName.includes('/') ? packageName : `hashicorp/${packageName}`;
  }

  private async queryRegistry(
    registryURL: string,
    repository: string
  ): Promise<ReleaseResult> {
    const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(
      registryURL
    );
    const backendURL = `${registryURL}${serviceDiscovery['providers.v1']}${repository}`;
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
    packageName: string,
    registryURL: string
  ): Promise<ReleaseResult | null> {
    const backendLookUpName = `terraform-provider-${packageName}`;
    const backendURL = registryURL + `/index.json`;
    const res = (
      await this.http.getJson<TerraformProviderReleaseBackend>(backendURL)
    ).body;

    if (!res[backendLookUpName]) {
      return null;
    }

    const dep: ReleaseResult = {
      releases: Object.keys(res[backendLookUpName].versions).map((version) => ({
        version,
      })),
      sourceUrl: `https://github.com/terraform-providers/${backendLookUpName}`,
    };
    logger.trace({ dep }, 'dep');
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
    version: string
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
          version
        );
      } catch (err) {
        /* istanbul ignore next */
        if (err instanceof ExternalHostError) {
          throw err;
        }
        logger.debug(
          { err, backendLookUpName, version },
          `Failed to retrieve builds for ${backendLookUpName} ${version}`
        );
        return null;
      }
      return versionReleaseBackend.builds;
    }

    // check public or private Terraform registry
    const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(
      registryURL
    );
    if (!serviceDiscovery) {
      logger.trace(`Failed to retrieve service discovery from ${registryURL}`);
      return null;
    }
    const backendURL = `${registryURL}${serviceDiscovery['providers.v1']}${repository}`;
    const versionsResponse = (
      await this.http.getJson<TerraformRegistryVersions>(
        `${backendURL}/versions`
      )
    ).body;
    if (!versionsResponse.versions) {
      logger.trace(`Failed to retrieve version list for ${backendURL}`);
      return null;
    }
    const builds = versionsResponse.versions.find(
      (value) => value.version === version
    );
    if (!builds) {
      logger.trace(
        `No builds found for ${repository}:${version} on ${registryURL}`
      );
      return null;
    }
    const result = await pMap(
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
      { concurrency: 4 }
    );

    const filteredResult = result.filter(is.truthy);
    return filteredResult.length === result.length ? filteredResult : null;
  }

  @cache({
    namespace: `datasource-${TerraformProviderDatasource.id}-releaseBackendIndex`,
    key: (backendLookUpName: string, version: string) =>
      `${backendLookUpName}/${version}`,
  })
  async getReleaseBackendIndex(
    backendLookUpName: string,
    version: string
  ): Promise<VersionDetailResponse> {
    return (
      await this.http.getJson<VersionDetailResponse>(
        `${TerraformProviderDatasource.defaultRegistryUrls[1]}/${backendLookUpName}/${version}/index.json`
      )
    ).body;
  }
}
