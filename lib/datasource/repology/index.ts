import { HOST_DISABLED } from '../../constants/error-messages';
import { logger } from '../../logger';
import { ExternalHostError } from '../../types/errors/external-host-error';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { getQueryString } from '../../util/url';
import type { GetReleasesConfig, ReleaseResult } from '../types';

export const id = 'repology';
export const customRegistrySupport = true;
export const defaultRegistryUrls = ['https://repology.org/'];
export const registryStrategy = 'hunt';

const http = new Http(id);
const cacheNamespace = `datasource-${id}-list`;
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
  registryUrl: string,
  repoName: string,
  packageName: string,
  packageType: RepologyPackageType
): Promise<RepologyPackage[]> {
  const query = getQueryString({
    repo: repoName,
    name_type: packageType,
    target_page: 'api_v1_project',
    noautoresolve: 'on',
    name: packageName,
  });

  // Retrieve list of packages by looking up Repology project
  const packages = await queryPackages(
    `${registryUrl}tools/project-by?${query}`
  );

  return packages;
}

async function queryPackagesViaAPI(
  registryUrl: string,
  packageName: string
): Promise<RepologyPackage[]> {
  // Directly query the package via the API. This will only work if `packageName` has the
  // same name as the repology project
  const packages = await queryPackages(
    `${registryUrl}api/v1/project/${packageName}`
  );

  return packages;
}

function findPackageInResponse(
  response: RepologyPackage[],
  repoName: string,
  pkgName: string,
  types: RepologyPackageType[]
): RepologyPackage[] | undefined {
  const repoPackages = response.filter((pkg) => pkg.repo === repoName);

  if (repoPackages.length === 0) {
    // no packages associated with repoName
    return null;
  }

  if (repoPackages.length === 1) {
    // repo contains exactly one package, so we can return them safely
    return repoPackages;
  }

  // In some cases Repology bundles multiple packages into a single project, which might result in ambiguous results.
  // We need to do additional filtering by matching allowed package types passed as params with package description.
  // Remaining packages are the one we are looking for
  let packagesWithType;
  for (const pkgType of types) {
    packagesWithType = repoPackages.filter(
      (pkg) => !pkg[pkgType] || pkg[pkgType] === pkgName
    );
    if (packagesWithType.length === 1) {
      break;
    }
  }

  return packagesWithType.length > 0 ? packagesWithType : null;
}

async function queryPackage(
  registryUrl: string,
  repoName: string,
  pkgName: string
): Promise<RepologyPackage[]> {
  let response: RepologyPackage[];
  let pkg: RepologyPackage[];
  // Try getting the packages from tools/project-by first for type binname and
  // afterwards for srcname. This needs to be done first, because some packages
  // resolve to repology projects which have a different name than the package
  // e.g. `pulseaudio-utils` resolves to project `pulseaudio`, BUT there is also
  // a project called `pulseaudio-utils` but it does not contain the package we
  // are looking for.
  try {
    for (const pkgType of packageTypes) {
      response = await queryPackagesViaResolver(
        registryUrl,
        repoName,
        pkgName,
        pkgType
      );

      if (response) {
        pkg = findPackageInResponse(response, repoName, pkgName, [pkgType]);
        if (pkg) {
          // exit immediately if package found
          return pkg;
        }
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
      response = await queryPackagesViaAPI(registryUrl, pkgName);
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
  registryUrl: string,
  repoName: string,
  pkgName: string
): Promise<RepologyPackage[]> {
  // Fetch previous result from cache if available
  const cacheKey = `${registryUrl}${repoName}/${pkgName}`;
  const cachedResult = await packageCache.get<RepologyPackage[]>(
    cacheNamespace,
    cacheKey
  );
  // istanbul ignore if
  if (cachedResult) {
    return cachedResult;
  }

  // Attempt a package lookup and return if found non empty list
  const pkg = await queryPackage(registryUrl, repoName, pkgName);
  if (pkg && pkg.length > 0) {
    await packageCache.set(cacheNamespace, cacheKey, pkg, cacheMinutes);
    return pkg;
  }

  // No package was found on Repology
  return null;
}

export async function getReleases({
  lookupName,
  registryUrl,
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
    const pkg = await getCachedPackage(registryUrl, repoName, pkgName);
    if (!pkg) {
      return null;
    }

    // Always prefer origversion if available, otherwise default to version
    // This is required as source packages usually have no origversion
    const releases = pkg.map((item) => ({
      version: item.origversion ?? item.version,
    }));
    return { releases };
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
