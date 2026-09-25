import { z } from 'zod/v4';
import { logger } from '../../../logger/index.ts';
import { coerceObject } from '../../../util/object.ts';
import { LooseRecord } from '../../../util/schema-utils/index.ts';
import type { Catalog } from '../npm/extract/types.ts';

const CatalogDependencies = LooseRecord(z.string());
const NamedCatalogs = LooseRecord(CatalogDependencies);

const CatalogFields = {
  catalog: CatalogDependencies.optional().catch(undefined),
  catalogs: NamedCatalogs.optional().catch(undefined),
};

/**
 * Bun catalogs live at the top level of the root `package.json` or under its
 * `workspaces` object. Malformed entries are dropped individually.
 */
export const BunCatalogs = z
  .object({
    ...CatalogFields,
    workspaces: z.object(CatalogFields).optional().catch(undefined),
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
  .catch(({ error }) => {
    logger.debug({ err: error }, 'bun: failed to parse catalogs');
    return [];
  });
