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
const packageTypes: RepologyPackageType[] = ['binname', 'srcname'];

export interface RepologyPackage {
  repo: string;
  visiblename: string;
  version: string;
  srcname?: string;
  binname?: string;
  origversion?: string;
}

async function queryPackages(url: string): Promise<RepologyPackage[]> {
  try {
    const res = await http.getJson<RepologyPackage[]>(url);
    return res.body;
  } catch (err) {
    if (err.statusCode === 404) {
      // Return an array here because the api does not return proper http codes
      // and instead of an 404 error an empty array with code 200 is returned
      // When querying the resolver 404 is thrown if package could not be resolved
      // and 403 if the repo is not supported
      // 403 is handled later because in this case we are trying the API
      return [];
    }

    throw err;
  }
}

async function queryPackagesViaResolver(
  repoName: string,
  packageName: string,
  packageType: RepologyPackageType
): Promise<RepologyPackage[]> {
  const query = new URLSearchParams({
    repo: repoName,
    name_type: packageType,
    target_page: 'api_v1_project',
    noautoresolve: 'on',
    name: packageName,
  }).toString();

  // Retrieve list of packages by looking up Repology project
  const packages = await queryPackages(
    `https://repology.org/tools/project-by?${query}`
  );

  return packages;
}

async function queryPackagesViaAPI(
  packageName: string
): Promise<RepologyPackage[]> {
  // Directly query the package via the API. This will only work if `packageName` has the
  // same name as the repology project
  const packages = await queryPackages(
    `https://repology.org/api/v1/project/${packageName}`
  );

  return packages;
}

function findPackageInResponse(
  response: RepologyPackage[],
  repoName: string,
  pkgName: string,
  types: RepologyPackageType[]
): RepologyPackage | undefined {
  let pkgs = response.filter((pkg) => pkg.repo === repoName);

  // In some cases Repology bundles multiple packages into a single project,
  // which would result in ambiguous results. If we have more than one result
  // left, we should try to determine the correct package by comparing either
  // binname or srcname (depending on `types`) to the given dependency name.
  if (pkgs.length > 1) {
    for (const pkgType of types) {
      pkgs = pkgs.filter((pkg) => !pkg[pkgType] || pkg[pkgType] === pkgName);
      if (pkgs.length === 1) {
        break;
      }
    }
  }

  // Abort if there is still more than one package left, as the result would
  // be ambiguous and unreliable. This should usually not happen...
  if (pkgs.length > 1) {
    logger.warn(
      { repoName, pkgName, packageTypes, pkgs },
      'Repology lookup returned ambiguous results, ignoring...'
    );
    return null;
  }

  // pkgs might be an empty array here and in that case we return undefined
  return pkgs[0];
}

async function queryPackage(
  repoName: string,
  pkgName: string
): Promise<RepologyPackage> {
  let response: RepologyPackage[];
  let pkg: RepologyPackage;
  // Try getting the packages from tools/project-by first for type binname and
  // afterwards for srcname. This needs to be done first, because some packages
  // resolve to repology projects which have a different name than the package
  // e.g. `pulseaudio-utils` resolves to project `pulseaudio`, BUT there is also
  // a project called `pulseaudio-utils` but it does not contain the package we
  // are looking for.
  try {
    for (const pkgType of packageTypes) {
      response = await queryPackagesViaResolver(repoName, pkgName, pkgType);

      pkg = findPackageInResponse(response, repoName, pkgName, [pkgType]);
      if (pkg) {
        // exit immediately if package found
        return pkg;
      }
    }
  } catch (err) {
    if (err.statusCode === 403) {
      logger.debug(
        { repoName, pkgName },
        'Repology does not support tools/project-by lookups for repository. Will try direct API access now'
      );

      // If the repository is not supported in tools/project-by we try directly accessing the
      // API. This will support all repositories but requires that the project name is equal to the
      // package name. This won't be always the case but for a good portion we might be able to resolve
      // the package this way.
      response = await queryPackagesViaAPI(pkgName);
      pkg = findPackageInResponse(response, repoName, pkgName, packageTypes);
      if (pkg) {
        // exit immediately if package found
        return pkg;
      }
    }
    throw err;
  }

  logger.debug(
    { repoName, pkgName },
    'Repository or package not found on Repology'
  );

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

  // Attempt a package lookup and return if successfully
  const pkg = await queryPackage(repoName, pkgName);
  if (pkg) {
    await packageCache.set(cacheNamespace, cacheKey, pkg, cacheMinutes);
    return pkg;
  }

  // No package was found on Repology
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
