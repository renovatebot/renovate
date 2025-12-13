import { isArray, isObject } from '@sindresorhus/is';
import { logger } from '../../../logger';
import { extractCatalogDeps } from '../npm/extract/common/catalogs';
import type { Catalog, NpmPackage } from '../npm/extract/types';
import type { NpmManagerData } from '../npm/types';
import type { PackageFileContent } from '../types';

export interface BunWorkspaces {
  packages?: string[] | string;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

interface BunCatalogs {
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

export function getBunCatalogsFromPackageJson(
  packageJson: NpmPackage,
): BunCatalogs | null {
  const workspaces = packageJson?.workspaces;
  const isWorkspacesObject = isObject(workspaces) && !isArray(workspaces);

  if (isWorkspacesObject) {
    const bunWorkspaces = workspaces as BunWorkspaces;
    if (!bunWorkspaces.catalog && !bunWorkspaces.catalogs) {
      return null;
    }
    return {
      catalog: bunWorkspaces.catalog,
      catalogs: bunWorkspaces.catalogs,
    };
  }

  const typedPackageJson = packageJson as NpmPackage & {
    catalog?: Record<string, string>;
    catalogs?: Record<string, Record<string, string>>;
  };

  const catalog = isObject(typedPackageJson.catalog)
    ? typedPackageJson.catalog
    : undefined;
  const catalogs = isObject(typedPackageJson.catalogs)
    ? typedPackageJson.catalogs
    : undefined;

  if (!catalog && !catalogs) {
    return null;
  }

  return { catalog, catalogs };
}

export function extractBunCatalogs(
  packageJson: NpmPackage,
  packageFile: string,
): PackageFileContent<NpmManagerData> | null {
  logger.trace(`bun.extractBunCatalogs(${packageFile})`);

  const bunCatalogs = getBunCatalogsFromPackageJson(packageJson);
  if (!bunCatalogs) {
    return null;
  }

  const catalogArray = bunCatalogsToArray(bunCatalogs);
  const deps = extractCatalogDeps(catalogArray, 'bun');

  return {
    deps,
    managerData: {
      packageJsonName: packageJson.name,
    },
  };
}

function bunCatalogsToArray({
  catalog: defaultCatalogDeps,
  catalogs: namedCatalogs,
}: BunCatalogs): Catalog[] {
  const result: Catalog[] = [];

  if (isObject(defaultCatalogDeps)) {
    result.push({ name: 'default', dependencies: defaultCatalogDeps });
  }

  if (!isObject(namedCatalogs)) {
    return result;
  }

  for (const [name, dependencies] of Object.entries(namedCatalogs)) {
    if (isObject(dependencies)) {
      result.push({
        name,
        dependencies,
      });
    }
  }

  return result;
}
