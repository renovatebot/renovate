import { type PackageDependency } from '../../../types.ts';
import { type NpmManagerData } from '../../types.ts';
import { type Catalog } from '../types.ts';
import { extractDependency, parseDepName } from './dependency.ts';

export const PNPM_CATALOG_DEPENDENCY = 'pnpm.catalog';
export const YARN_CATALOG_DEPENDENCY = 'yarn.catalog';

/**
 * In order to facilitate matching on specific catalogs, we structure the
 * depType as `[pnpm|yarn].catalog.default`, `[pnpm|yarn].catalog.react17`, and so on.
 */
function getCatalogDepType(name: string, npmManager: 'pnpm' | 'yarn'): string {
  return `${npmManager === 'pnpm' ? PNPM_CATALOG_DEPENDENCY : YARN_CATALOG_DEPENDENCY}.${name}`;
}
export function extractCatalogDeps(
  catalogs: Catalog[],
  npmManager: 'pnpm' | 'yarn' = 'pnpm',
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
