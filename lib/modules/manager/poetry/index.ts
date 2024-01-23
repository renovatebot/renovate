import type { Category } from '../../../constants';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { bumpPackageVersion } from '../pep621/update';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { updateLockedDependency } from './update-locked';

export const supportedDatasources = [
  PypiDatasource.id,
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
  GitRefsDatasource.id,
];

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)pyproject\\.toml$'],
};

export const categories: Category[] = ['python'];
