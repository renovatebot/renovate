import { type PackageDependency } from '../../../types';
import { type NpmManagerData } from '../../types';
import { type Catalog } from '../types';
import { extractDependency, parseDepName } from './dependency';

export const PNPM_CATALOG_DEPENDENCY = 'pnpm.catalog';
export const YARN_CATALOG_DEPENDENCY = 'yarn.catalog';
export const BUN_CATALOG_DEPENDENCY = 'bun.catalog';

/**
 * In order to facilitate matching on specific catalogs, we structure the
 * depType as `[pnpm|yarn|bun].catalog.default`, `[pnpm|yarn|bun].catalog.react17`, and so on.
 */
function getCatalogDepType(
  name: string,
  npmManager: 'pnpm' | 'yarn' | 'bun',
): string {
  switch (npmManager) {
    case 'pnpm':
      return `${PNPM_CATALOG_DEPENDENCY}.${name}`;
    case 'yarn':
      return `${YARN_CATALOG_DEPENDENCY}.${name}`;
    case 'bun':
      return `${BUN_CATALOG_DEPENDENCY}.${name}`;
  }
}
export function extractCatalogDeps(
  catalogs: Catalog[],
  npmManager: 'pnpm' | 'yarn' | 'bun' = 'pnpm',
): PackageDependency<NpmManagerData>[] {
  const deps: PackageDependency<NpmManagerData>[] = [];

  for (const catalog of catalogs) {
    for (const [key, val] of Object.entries(catalog.dependencies)) {
      const depType = getCatalogDepType(catalog.name, npmManager);
      const depName = parseDepName(depType, key);
      const dep: PackageDependency<NpmManagerData> = {
        depType,
        depName,
        ...extractDependency(depType, depName, val!),
        prettyDepType: depType,
      };
      deps.push(dep);
    }
  }

  return deps;
}
