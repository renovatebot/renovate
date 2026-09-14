import { z } from 'zod/v4';
import { coerceObject } from '../../../util/object.ts';
import type { Catalog } from '../npm/extract/types.ts';

const CatalogDependencies = z.record(z.string(), z.string());
const NamedCatalogs = z.record(z.string(), CatalogDependencies);

/**
 * Bun catalogs live at the top level of the root `package.json` or under its
 * `workspaces` object.
 */
export const BunCatalogs = z
  .object({
    catalog: CatalogDependencies.optional(),
    catalogs: NamedCatalogs.optional(),
    workspaces: z
      .object({
        catalog: CatalogDependencies.optional(),
        catalogs: NamedCatalogs.optional(),
      })
      .optional()
      .catch(undefined),
  })
  .transform(({ catalog, catalogs, workspaces }): Catalog[] => {
    const result: Catalog[] = [];
    const defaultCatalog = catalog ?? workspaces?.catalog;
    if (defaultCatalog) {
      result.push({ name: 'default', dependencies: defaultCatalog });
    }
    const namedCatalogs = coerceObject(catalogs ?? workspaces?.catalogs);
    for (const [name, dependencies] of Object.entries(namedCatalogs)) {
      result.push({ name, dependencies });
    }
    return result;
  })
  .catch([]);
