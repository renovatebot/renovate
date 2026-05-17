import { type PackageDependency } from '../../../types.ts';
import { type NpmManagerData } from '../../types.ts';
import { type Catalog } from '../types.ts';
import { extractDependency, parseDepName } from './dependency.ts';

export const PNPM_CATALOG_DEPENDENCY = 'pnpm.catalog';
export const YARN_CATALOG_DEPENDENCY = 'yarn.catalog';
export const BUN_CATALOG_DEPENDENCY = 'bun.catalog';

type CatalogManager = 'pnpm' | 'yarn' | 'bun';

const catalogPrefixes: Record<CatalogManager, string> = {
  pnpm: PNPM_CATALOG_DEPENDENCY,
  yarn: YARN_CATALOG_DEPENDENCY,
  bun: BUN_CATALOG_DEPENDENCY,
};

/**
 * In order to facilitate matching on specific catalogs, we structure the
 * depType as `[pnpm|yarn|bun].catalog.default`, `[pnpm|yarn|bun].catalog.react17`, and so on.
 */
function getCatalogDepType(name: string, npmManager: CatalogManager): string {
  return `${catalogPrefixes[npmManager]}.${name}`;
}
export function extractCatalogDeps(
  catalogs: Catalog[],
  npmManager: CatalogManager = 'pnpm',
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
