import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import { Http } from '../../util/http';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'terraform-provider';

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
  backendURL: string,
  repository: string
): Promise<ReleaseResult> {
  try {
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
    dep.homepage = `https://registry.terraform.io/providers/${repository}`;
    logger.trace({ dep }, 'dep');
    return dep;
  } catch (err) {
    logger.debug(
      { lookupName },
      `Terraform registry ("registry.terraform.io") lookup failure: not found`
    );
    logger.debug({
      err,
    });
    return null;
  }
}

async function queryReleaseBackend(
  lookupName: string,
  backendURL: string,
  repository: string
): Promise<ReleaseResult> {
  const backendLookUpName = `terraform-provider-${lookupName}`;
  try {
    const res = (
      await http.getJson<TerraformProviderReleaseBackend>(backendURL)
    ).body;
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
  } catch (err) {
    logger.debug(
      { lookupName },
      `Terraform registry ("releases.hashicorp.com") lookup failure: not found`
    );
    logger.debug({
      err,
    });
    return null;
  }
}

/**
 * terraform-provider.getReleases
 *
 * This function will fetch a provider from the public Terraform registry and return all semver versions.
 */
export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const repository = `hashicorp/${lookupName}`;

  const releasesBackendURL = `https://releases.hashicorp.com/index.json`;
  const registryBackendURL = `https://registry.terraform.io/v1/providers/${repository}`;

  logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
  const cacheNamespace = 'terraform-providers';
  const cacheMinutes = 30;
  const cachedResult = await globalCache.get<ReleaseResult>(
    cacheNamespace,
    lookupName
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  let dep = await queryRegistry(lookupName, registryBackendURL, repository);
  if (dep) {
    await globalCache.set(cacheNamespace, lookupName, dep, cacheMinutes);
    return dep;
  }
  dep = await queryReleaseBackend(lookupName, releasesBackendURL, repository);
  if (dep) {
    await globalCache.set(cacheNamespace, lookupName, dep, cacheMinutes);
  }
  return dep;
}
