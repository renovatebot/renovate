import type { Category } from '../../../constants';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as hexVersioning from '../../versioning/hex';

export const displayName = 'gleam';
export const url = 'https://gleam.run/';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['^gleam.toml$'],
  versioning: version.id,
};

export const supportsLockFileMaintenance = true;
export const categories: Category[] = ['gleam'];
export const supportedDatasources = [GithubTagsDatasource.id];
