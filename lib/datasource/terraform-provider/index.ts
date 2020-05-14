import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import { Http } from '../../util/http';
import { DatasourceError, GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'terraform-provider';

const http = new Http(id);

interface TerraformProvider {
  namespace: string;
  name: string;
  provider: string;
  source?: string;
  versions: string[];
}

/**
 * terraform-provider.getReleases
 *
 * This function will fetch a provider from the public Terraform registry and return all semver versions.
 */
export async function getReleases({
  lookupName,
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const repository = `hashicorp/${lookupName}`;

  logger.debug({ lookupName }, 'terraform-provider.getDependencies()');
  const cacheNamespace = 'terraform-providers';
  const pkgUrl = `https://registry.terraform.io/v1/providers/${repository}`;
  const cachedResult = await globalCache.get<ReleaseResult>(
    cacheNamespace,
    pkgUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const res = (await http.getJson<TerraformProvider>(pkgUrl)).body;
    // Simplify response before caching and returning
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
    if (pkgUrl.startsWith('https://registry.terraform.io/')) {
      dep.homepage = `https://registry.terraform.io/providers/${repository}`;
    }
    logger.trace({ dep }, 'dep');
    const cacheMinutes = 30;
    await globalCache.set(cacheNamespace, pkgUrl, dep, cacheMinutes);
    return dep;
  } catch (err) {
    if (err.statusCode === 404 || err.code === 'ENOTFOUND') {
      logger.debug(
        { lookupName },
        `Terraform registry lookup failure: not found`
      );
      logger.debug({
        err,
      });
      return null;
    }
    const failureCodes = ['EAI_AGAIN'];
    // istanbul ignore if
    if (failureCodes.includes(err.code)) {
      throw new DatasourceError(err);
    }
    logger.warn(
      { err, lookupName },
      'Terraform registry failure: Unknown error'
    );
    return null;
  }
}
