import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as rustVersioning from '../../versioning/rust-toolchain';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)rust-toolchain(\\.toml)?$'],
  versioning: rustVersioning.id,
};

export const categories: Category[] = ['rust'];
