import { URLSearchParams } from 'url';
import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { GetReleasesConfig, ReleaseResult } from '../common';

export const id = 'repology';

const http = new Http(id);
const cacheNamespace = `datasource-${id}`;
const cacheMinutes = 60;

export type RepologyPackageType = 'binname' | 'srcname';

export interface RepologyPackage {
  repo: string;
  visiblename: string;
  version: string;
  srcname?: string;
  binname?: string;
  origversion?: string;
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

    // Retrieve list of packages by looking up Repology project
    const url = `https://repology.org/tools/project-by?${query}`;
    const res = await http.getJson<RepologyPackage[]>(url);
    let pkgs = res.body.filter((pkg) => pkg.repo === repoName);

    // In some cases Repology bundles multiple packages into a single project,
    // which would result in ambiguous results. If we have more than one result
    // left, we should try to determine the correct package by comparing either
    // binname or srcname (depending on pkgType) to the given dependency name.
    if (pkgs.length > 1) {
      pkgs = pkgs.filter((pkg) => !pkg[pkgType] || pkg[pkgType] === pkgName);
    }

    // Abort if there is still more than one package left, as the result would
    // be ambiguous and unreliable. This should usually not happen...
    if (pkgs.length > 1) {
      logger.warn(
        { repoName, pkgName, pkgType, pkgs },
        'Repology lookup returned ambiguous results, ignoring...'
      );
      return null;
    }

    return pkgs[0];
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
  const cachedResult = await packageCache.get<RepologyPackage>(
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
    await packageCache.set(cacheNamespace, cacheKey, binPkg, cacheMinutes);
    return binPkg;
  }

  // Otherwise, attempt a source package lookup and return if successfully
  const srcPkg = await queryPackage(repoName, pkgName, 'srcname');
  if (srcPkg) {
    await packageCache.set(cacheNamespace, cacheKey, srcPkg, cacheMinutes);
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
    throw new ExternalHostError(
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
    if (err.message === HOST_DISABLED) {
      // istanbul ignore next
      logger.trace({ lookupName, err }, 'Host disabled');
    } else {
      logger.warn(
        { lookupName, err },
        'Repology lookup failed with unexpected error'
      );
    }

    throw new ExternalHostError(err);
  }
}
