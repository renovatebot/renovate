import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { updateLockedDependency } from './update-locked';

export const supportedDatasources = [
  PypiDatasource.id,
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
];

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)pyproject\\.toml$'],
};

export const categories: Category[] = ['python'];
