import { RustVersionDatasource } from '../../../datasource/rust-version/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { valSchema } from './utils.ts';

export const rustVersionActions: Record<string, KnownActionConfig> = {
  // https://github.com/dtolnay/rust-toolchain
  'dtolnay/rust-toolchain': {
    datasource: RustVersionDatasource.id,
    packageName: 'rust',
    withSchema: valSchema('toolchain'),
  },
  // https://github.com/moonrepo/setup-rust
  'moonrepo/setup-rust': {
    datasource: RustVersionDatasource.id,
    packageName: 'rust',
    withSchema: valSchema('channel'),
  },
};
