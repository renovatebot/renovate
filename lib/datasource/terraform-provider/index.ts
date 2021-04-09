import URL from 'url';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import * as hashicorpVersioning from '../../versioning/hashicorp';
import { getTerraformServiceDiscoveryResult } from '../terraform-module';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'terraform-provider';
export const customRegistrySupport = true;
export const defaultRegistryUrls = [
  'https://registry.terraform.io',
  'https://releases.hashicorp.com',
];
export const defaultVersioning = hashicorpVersioning.id;
export const registryStrategy = 'hunt';

const http = new Http(id);

interface TerraformProvider {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
  version: string;
  published_at: string;
}

interface TerraformProviderReleaseBackend {
  [key: string]: {
    name: string;
    versions: VersionsReleaseBackend;
  };
}

interface VersionsReleaseBackend {
  [key: string]: Record<string, any>;
}

async function queryRegistry(
  lookupName: string,
  registryURL: string,
  repository: string
): Promise<ReleaseResult> {
  const serviceDiscovery = await getTerraformServiceDiscoveryResult(
    registryURL
  );
  const backendURL = `${registryURL}${serviceDiscovery['providers.v1']}${repository}`;
  const res = (await http.getJson<TerraformProvider>(backendURL)).body;
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

// TODO: add long term cache
async function queryReleaseBackend(
  lookupName: string,
  registryURL: string,
  repository: string
): Promise<ReleaseResult> {
  const backendLookUpName = `terraform-provider-${lookupName}`;
  const backendURL = registryURL + `/index.json`;
  const res = (await http.getJson<TerraformProviderReleaseBackend>(backendURL))
    .body;

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

/**
 * terraform-provider.getReleases
 *
 * This function will fetch a provider from the public Terraform registry and return all semver versions.
 */
export async function getReleases({
  lookupName,
  registryUrl,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const repository = lookupName.includes('/')
    ? lookupName
    : `hashicorp/${lookupName}`;

  const cacheNamespace = 'terraform-provider';
  const pkgUrl = `${registryUrl}/${repository}`;
  const cachedResult = await packageCache.get<ReleaseResult>(
    cacheNamespace,
    pkgUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
  let dep: ReleaseResult = null;
  const registryHost = URL.parse(registryUrl).host;
  if (registryHost === 'releases.hashicorp.com') {
    dep = await queryReleaseBackend(lookupName, registryUrl, repository);
  } else {
    dep = await queryRegistry(lookupName, registryUrl, repository);
  }
  const cacheMinutes = 30;
  await packageCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
  return dep;
}
