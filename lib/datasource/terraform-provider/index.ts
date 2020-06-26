import URL from 'url';
import { logger } from '../../logger';
import { Http } from '../../util/http';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'terraform-provider';
export const defaultRegistryUrls = [
  'https://registry.terraform.io',
  'https://releases.hashicorp.com',
];
export const registryStrategy = 'hunt';

const http = new Http(id);

interface TerraformProvider {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
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
  const backendURL = `${registryURL}/v1/providers/${repository}`;
  const res = (await http.getJson<TerraformProvider>(backendURL)).body;
  const dep: ReleaseResult = {
    name: repository,
    versions: {},
    releases: null,
  };
  if (res.source) {
    dep.sourceUrl = res.source;
  }
  dep.releases = res.versions.map((version) => ({
    version,
  }));
  dep.homepage = `${registryURL}/providers/${repository}`;
  logger.trace({ dep }, 'dep');
  return dep;
}

async function queryReleaseBackend(
  lookupName: string,
  registryURL: string,
  repository: string
): Promise<ReleaseResult> {
  const backendLookUpName = `terraform-provider-${lookupName}`;
  const backendURL = registryURL + `/index.json`;
  const res = (await http.getJson<TerraformProviderReleaseBackend>(backendURL))
    .body;
  const dep: ReleaseResult = {
    name: repository,
    versions: {},
    releases: null,
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
  const repository = `hashicorp/${lookupName}`;

  logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
  let dep: ReleaseResult = null;
  const registryHost = URL.parse(registryUrl).host;
  if (registryHost === 'registry.terraform.io') {
    dep = await queryRegistry(lookupName, registryUrl, repository);
  } else if (registryHost === 'releases.hashicorp.com') {
    dep = await queryReleaseBackend(lookupName, registryUrl, repository);
  }
  return dep;
}
