import { z } from 'zod/v4';
import { CrateDatasource } from '../../../datasource/crate/index.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';
import { parseValue } from './utils.ts';

// Same shape as `InstallBinaryWith` (see `github-releases-dynamic.ts`), but
// the package name comes from a crates.io crate name rather than a GitHub
// repo. `version` has a default (`'latest'`), so real workflows commonly
// omit it from `with:` entirely.
const CargoInstallWith: ActionSchema = z
  .object({ crate: z.string(), version: z.string().optional() })
  .transform(({ crate, version }) => [
    { packageName: crate, ...parseValue(version) },
  ]);

export const crateDynamicActions: Record<string, KnownActionConfig> = {
  // https://github.com/baptiste0928/cargo-install
  'baptiste0928/cargo-install': {
    datasource: CrateDatasource.id,
    packageName: '', // determined from the `crate` input
    withSchema: CargoInstallWith,
  },
};
