import type { Category } from '../../../constants/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';

export { bumpPackageVersion } from '../pep621/update.ts';
export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { updateLockedDependency } from './update-locked.ts';

export const supersedesManagers = ['pep621'];
export const supportsLockFileMaintenance = true;
export const lockFileNames = ['poetry.lock'];

export const url = 'https://python-poetry.org/docs';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)pyproject\\.toml$/'],
};

export const supportedDatasources = [
  PypiDatasource.id,
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
  GitlabTagsDatasource.id,
  GitRefsDatasource.id,
  GitTagsDatasource.id,
];
