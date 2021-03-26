import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'terraform-module';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://registry.terraform.io'];
export const defaultVersioning = hashicorpVersioning.id;
export const registryStrategy = 'first';

const http = new Http(id);

interface RegistryRepository {
  registry: string;
  repository: string;
}

function getRegistryRepository(
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
  if (!/^https?:\/\//.test(registry)) {
    registry = `https://${registry}`;
  }
  const repository = split.join('/');
  return {
    registry,
    repository,
  };
}

interface TerraformRelease {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
  version: string;
  published_at: string;
}

export interface ServiceDiscoveryResult {
  'modules.v1'?: string;
  'providers.v1'?: string;
}

export async function getTerraformServiceDiscoveryResult(
  registryUrl: string
): Promise<ServiceDiscoveryResult> {
  const discoveryURL = `${registryUrl}/.well-known/terraform.json`;
  const cacheNamespace = 'terraform-service-discovery';
  const cachedResult = await packageCache.get<ServiceDiscoveryResult>(
    cacheNamespace,
    registryUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const serviceDiscovery = (
    await http.getJson<ServiceDiscoveryResult>(discoveryURL)
  ).body;

  const cacheMinutes = 1440; // 24h
  await packageCache.set(
    cacheNamespace,
    registryUrl,
    serviceDiscovery,
    cacheMinutes
  );

  return serviceDiscovery;
}
/**
 * terraform.getReleases
 *
 * This function will fetch a package from the specified Terraform registry and return all semver versions.
 *  - `sourceUrl` is supported of "source" field is set
 *  - `homepage` is set to the Terraform registry's page if it's on the official main registry
 */
export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const { registry, repository } = getRegistryRepository(
    lookupName,
    registryUrl
  );
  logger.debug(
    { registry, terraformRepository: repository },
    'terraform.getDependencies()'
  );
  const cacheNamespace = 'terraform-module';
  const cacheURL = `${registry}/${repository}`;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    cacheURL
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const serviceDiscovery = await getTerraformServiceDiscoveryResult(
      registryUrl
    );
    const pkgUrl = `${registry}${serviceDiscovery['modules.v1']}${repository}`;
    const res = (await http.getJson<TerraformRelease>(pkgUrl)).body;
    const returnedName = res.namespace + '/' + res.name + '/' + res.provider;
    if (returnedName !== repository) {
      logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
      return null;
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
    const cacheMinutes = 30;
    await packageCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
    return dep;
  } catch (err) {
    const failureCodes = ['EAI_AGAIN'];
    // istanbul ignore if
    if (failureCodes.includes(err.code)) {
      throw new ExternalHostError(err);
    }
    throw err;
  }
}
