import type { Category } from '../../../constants/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import type { MinimumReleaseAgeSupport } from '../types.ts';
import { poetryMinReleaseAgeVersion } from './minimum-release-age.ts';

export { bumpPackageVersion } from '../pep621/update.ts';
export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { updateLockedDependency } from './update-locked.ts';

export const supersedesManagers = ['pep621'];
export const supportsLockFileMaintenance = true;
export const lockFileNames = ['poetry.lock'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const url = 'https://python-poetry.org/docs';
export const categories: Category[] = ['python'];

export const minimumReleaseAgeSupport: MinimumReleaseAgeSupport = {
  poetry: {
    passesMinimumReleaseAge: `>=${poetryMinReleaseAgeVersion}`,
    readsConfiguredAge: `>=${poetryMinReleaseAgeVersion}`,
    note: 'Sets `POETRY_SOLVER_MIN_RELEASE_AGE`, rounded up to whole days. With `minimumReleaseAgePackageManagerSync`, passes the `minimumReleaseAge` of the repository or manager config instead of the one of the update, reads `solver.min-release-age` and `solver.min-release-age-exclude` from the `poetry.toml` next to `pyproject.toml`, sets no age variable if the value equals the Poetry value, and sets `POETRY_SOLVER_MIN_RELEASE_AGE_EXCLUDE` for updated packages with a smaller `minimumReleaseAge` which pin a single version. Older Poetry versions ignore them.',
  },
};

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

export { knownDepTypes, supportsDynamicDepTypesNote } from './dep-types.ts';
