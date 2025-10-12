import type { Category } from '../../../constants/index.ts';
import { RustVersionDatasource } from '../../datasource/rust-version/index.ts';

export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'Rust Toolchain';
export const url =
  'https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file';
export const categories: Category[] = ['rust'];

export const defaultConfig = {
  commitMessageTopic: 'Rust',
  managerFilePatterns: ['/(^|/)rust-toolchain\\.toml$/'],
};

export const supportedDatasources = [RustVersionDatasource.id];
