import { logger } from '../../logger';
import got from '../../util/got';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'terraform-provider';

interface TerraformProvider {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
}

/**
 * terraform-provider.getPkgReleases
 *
 * This function will fetch a provider from the public Terraform registry and return all semver versions.
 */
export async function getPkgReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const repository = `hashicorp/${lookupName}`;

  logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
  const cacheNamespace = 'terraform-providers';
  const pkgUrl = `https://registry.terraform.io/v1/providers/${repository}`;
  const cachedResult = await renovateCache.get<ReleaseResult>(
    cacheNamespace,
    pkgUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  const res: TerraformProvider = (
    await got(pkgUrl, {
      json: true,
      hostType: id,
    })
  ).body;
  // Simplify response before caching and returning
  const dep: ReleaseResult = {
    name: repository,
    versions: {},
    releases: null,
  };
  if (res.source) {
    dep.sourceUrl = res.source;
  }
  dep.releases = res.versions.map(version => ({
    version,
  }));
  if (pkgUrl.startsWith('https://registry.terraform.io/')) {
    dep.homepage = `https://registry.terraform.io/providers/${repository}`;
  }
  logger.trace({ dep }, 'dep');
  const cacheMinutes = 30;
  await renovateCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
  return dep;
}
