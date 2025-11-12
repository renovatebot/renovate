import { isObject } from '@sindresorhus/is';
import { logger } from '../../../logger';
import { extractCatalogDeps } from '../npm/extract/common/catalogs';
import type { Catalog } from '../npm/extract/types';
import type { NpmManagerData } from '../npm/types';
import type { PackageFileContent } from '../types';

export interface BunWorkspaces {
  packages?: string[] | string;
  catalog?: Record<string, string>;
  catalogs?: Record<string, Record<string, string>>;
}

export function extractBunCatalogs(
  packageJson: any,
  packageFile: string,
): PackageFileContent<NpmManagerData> | null {
  logger.trace(`bun.extractBunCatalogs(${packageFile})`);

  const workspaces = packageJson?.workspaces as BunWorkspaces;
  if (!isObject(workspaces)) {
    return null;
  }

  const catalog = workspaces.catalog;
  const catalogs = workspaces.catalogs;

  if (!catalog && !catalogs) {
    return null;
  }

  const bunCatalogs = bunCatalogsToArray({ catalog, catalogs });
  const deps = extractCatalogDeps(bunCatalogs, 'bun');

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
}: BunWorkspaces): Catalog[] {
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
