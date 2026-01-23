import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { RustNightlyDatasource } from '../../datasource/rust-nightly';

export { extractPackageFile } from './extract';

export const displayName = 'Rust Toolchain';
export const url =
  'https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file';
export const categories: Category[] = ['rust'];

export const defaultConfig = {
  commitMessageTopic: 'Rust',
  managerFilePatterns: ['/(^|/)rust-toolchain(\\.toml)?$/'],
};

export const supportedDatasources = [
  GithubReleasesDatasource.id,
  RustNightlyDatasource.id,
];
