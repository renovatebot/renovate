import { knownDepTypes as npmKnownDepTypes } from '../npm/dep-types.ts';

/**
 * Bun reads the same `package.json` fields as npm, except the pnpm-specific
 * ones.
 */
export const knownDepTypes = npmKnownDepTypes.filter(
  ({ depType }) => !depType.startsWith('pnpm'),
);

export const supportsDynamicDepTypesNote =
  'Catalog dependencies produce dynamic `depType` values: `bun.catalog.default` for the default catalog, and `bun.catalog.<name>` for named catalogs (see [Bun catalogs](https://bun.sh/docs/install/catalogs)).';
