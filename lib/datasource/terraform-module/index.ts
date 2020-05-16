import is from '@sindresorhus/is';
import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import { Http } from '../../util/http';
import { DatasourceError, GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'terraform-module';

const http = new Http(id);

interface RegistryRepository {
  registry: string;
  repository: string;
}

function getRegistryRepository(
  lookupName: string,
  registryUrls: string[]
): RegistryRepository {
  let registry: string;
  const split = lookupName.split('/');
  if (split.length > 3 && split[0].includes('.')) {
    [registry] = split;
    split.shift();
  } else if (is.nonEmptyArray(registryUrls)) {
    [registry] = registryUrls;
  } else {
    registry = 'registry.terraform.io';
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
  registryUrls,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  const { registry, repository } = getRegistryRepository(
    lookupName,
    registryUrls
  );
  logger.debug(
    { registry, terraformRepository: repository },
    'terraform.getDependencies()'
  );
  const cacheNamespace = 'terraform-module';
  const pkgUrl = `${registry}/v1/modules/${repository}`;
  const cachedResult = await globalCache.get<ReleaseResult>(
    cacheNamespace,
    pkgUrl
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const res = (await http.getJson<TerraformRelease>(pkgUrl)).body;
    const returnedName = res.namespace + '/' + res.name + '/' + res.provider;
    if (returnedName !== repository) {
      logger.warn({ pkgUrl }, 'Terraform registry result mismatch');
      return null;
    }
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
      dep.homepage = `https://registry.terraform.io/modules/${repository}`;
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
