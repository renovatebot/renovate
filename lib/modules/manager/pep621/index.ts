import type { Category } from '../../../constants/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { PythonVersionDatasource } from '../../datasource/python-version/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { bumpPackageVersion } from './update.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['pdm.lock', 'uv.lock'];
export const lockFileMaintenanceIsDelegatedToPackageManager =
  'Delegated to the underlying package manager CLI - `pdm` or `uv` - depending on which lockfile format the project uses.';

export const displayName = 'PEP 621';
export const url = 'https://peps.python.org/pep-0621';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)pyproject\\.toml$/'],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  GitRefsDatasource.id,
  GitTagsDatasource.id,
  PypiDatasource.id,
  PythonVersionDatasource.id,
];

export { knownDepTypes, supportsDynamicDepTypesNote } from './dep-types.ts';
