import { URLSearchParams } from 'url';
import { logger } from '../../logger';
import * as globalCache from '../../util/cache/global';
import { Http } from '../../util/http';
import { DatasourceError, GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'repology';

const http = new Http(id);
const cacheNamespace = `datasource-${id}`;
const cacheMinutes = 60;

export type RepologyPackageType = 'binname' | 'srcname';

export interface RepologyPackage {
  repo: string;
  visiblename: string;
  version: string;
  origversion: string | null;
}

async function queryPackage(
  repoName: string,
  pkgName: string,
  pkgType: RepologyPackageType
): Promise<RepologyPackage> {
  try {
    const query = new URLSearchParams({
      repo: repoName,
      name_type: pkgType,
      target_page: 'api_v1_project',
      noautoresolve: 'on',
      name: pkgName,
    }).toString();

    const url = `https://repology.org/tools/project-by?${query}`;
    const res = await http.getJson<RepologyPackage[]>(url);

    return res.body.find(
      (x) => x.repo.toLowerCase() === repoName.toLowerCase()
    );
  } catch (err) {
    if (err.statusCode === 404) {
      logger.debug(
        { repoName, pkgName, pkgType },
        'Repository or package not found on Repology'
      );
    } else if (err.statusCode === 403) {
      logger.debug(
        { repoName },
        'Repology does not support tools/project-by lookups for repository'
      );
    } else {
      throw err;
    }
  }

  return null;
}

async function getCachedPackage(
  repoName: string,
  pkgName: string
): Promise<RepologyPackage> {
  // Fetch previous result from cache if available
  const cacheKey = `${repoName}/${pkgName}`;
  const cachedResult = await globalCache.get<RepologyPackage>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  // Attempt a binary package lookup and return if successfully
  const binPkg = await queryPackage(repoName, pkgName, 'binname');
  if (binPkg) {
    await globalCache.set(cacheNamespace, cacheKey, binPkg, cacheMinutes);
    return binPkg;
  }

  // Otherwise, attempt a source package lookup and return if successfully
  const srcPkg = await queryPackage(repoName, pkgName, 'srcname');
  if (srcPkg) {
    await globalCache.set(cacheNamespace, cacheKey, srcPkg, cacheMinutes);
    return srcPkg;
  }

  // No binary or source package was found on Repology
  return null;
}

export async function getReleases({
  lookupName,
}: GetReleasesConfig): Promise<ReleaseResult | null> {
  // Ensure lookup name contains both repository and package
  const [repoName, pkgName] = lookupName.split('/', 2);
  if (!repoName || !pkgName) {
    throw new DatasourceError(
      new Error(
        'Repology lookup name must contain repository and package separated by slash (<repo>/<pkg>)'
      )
    );
  }

  // Attempt to resolve package version through Repology
  logger.trace(`repology.getReleases(${repoName}, ${pkgName})`);
  try {
    // Attempt to retrieve (cached) package information from Repology
    const pkg = await getCachedPackage(repoName, pkgName);
    if (!pkg) {
      return null;
    }

    // Always prefer origversion if available, otherwise default to version
    // This is required as source packages usually have no origversion
    const version = pkg.origversion ?? pkg.version;
    return { releases: [{ version }] };
  } catch (err) {
    logger.warn(
      { lookupName, err },
      'Repology lookup failed with unexpected error'
    );
    throw new DatasourceError(err);
  }
}
