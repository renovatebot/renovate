import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import { cache } from '../../util/cache/package/decorator';
import type { HttpError } from '../../util/http/types';
import { regEx } from '../../util/regex';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import type { GetReleasesConfig, ReleaseResult } from '../types';
import { TerraformDatasource } from './base';
import type { RegistryRepository, TerraformRelease } from './types';

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
    lookupName,
    registryUrl,
  }: GetReleasesConfig): Promise<ReleaseResult | null> {
    const { registry, repository } =
      TerraformModuleDatasource.getRegistryRepository(lookupName, registryUrl);
    logger.trace(
      { registry, terraformRepository: repository },
      'terraform-module.getReleases()'
    );

    let res: TerraformRelease;
    let pkgUrl: string;

    try {
      const serviceDiscovery = await this.getTerraformServiceDiscoveryResult(
        registryUrl
      );
      pkgUrl = `${registry}${serviceDiscovery['modules.v1']}${repository}`;
      res = (await this.http.getJson<TerraformRelease>(pkgUrl)).body;
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
      releases: null,
    };
    if (res.source) {
      dep.sourceUrl = res.source;
    }
    dep.releases = res.versions.map((version) => ({
      version,
    }));
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

    logger.trace({ dep }, 'dep');
    return dep;
  }

  // eslint-disable-next-line class-methods-use-this
  override handleSpecificErrors(err: HttpError): void {
    const failureCodes = ['EAI_AGAIN'];
    // istanbul ignore if
    if (failureCodes.includes(err.code)) {
      throw new ExternalHostError(err);
    }
  }

  private static getRegistryRepository(
    lookupName: string,
    registryUrl: string
  ): RegistryRepository {
    let registry: string;
    const split = lookupName.split('/');
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
    lookupName,
    registryUrl,
  }: GetReleasesConfig): string {
    const { registry, repository } =
      TerraformModuleDatasource.getRegistryRepository(lookupName, registryUrl);
    return `${registry}/${repository}`;
  }
}
