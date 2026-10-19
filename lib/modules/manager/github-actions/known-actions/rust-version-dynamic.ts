import { z } from 'zod/v4';
import { RustVersionDatasource } from '../../../datasource/rust-version/index.ts';
import type { ActionSchema, KnownActionConfig } from '../types.ts';
import { parseValue } from './utils.ts';

// `actions-rust-lang/setup-rust-toolchain`'s `toolchain` input is a
// comma-separated list of toolchains; only the LAST one becomes the active
// default toolchain, so that's the only one worth tracking.
const SetupRustToolchainWith: ActionSchema = z
  .object({ toolchain: z.string().optional() })
  .transform(({ toolchain }) => [
    parseValue(toolchain?.split(',').pop()?.trim()),
  ]);

export const rustVersionDynamicActions: Record<string, KnownActionConfig> = {
  // https://github.com/actions-rust-lang/setup-rust-toolchain
  'actions-rust-lang/setup-rust-toolchain': {
    datasource: RustVersionDatasource.id,
    packageName: 'rust',
    withSchema: SetupRustToolchainWith,
  },
};
