import type { Category } from '../../../constants/index.ts';
import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { PypiDatasource } from '../../datasource/pypi/index.ts';
import { PythonVersionDatasource } from '../../datasource/python-version/index.ts';

// A `pyproject.toml` this manager claims can carry a version of its own, and
// the delegates that read those files bump it the same way.
export { bumpPackageVersion } from '../pep621/update.ts';
export { knownDepTypes, supportsDynamicDepTypesNote } from './dep-types.ts';
export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

// A generator source is usually also matched by the manager owning its format,
// which would give the same file two entries and two pull requests. Renovate
// drops the superseded manager's entry for any file this one reported, and a
// source this manager cannot maintain is not reported at all, so the manager
// that can keeps it.
export const supersedesManagers = ['pip_requirements', 'pep621', 'poetry'];

export const displayName = 'Pants';
export const url = 'https://www.pantsbuild.org/stable/docs/python';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  // Pants' own default `build_patterns`. Renovate compiles these with RE2, so no
  // lookahead can narrow it further.
  managerFilePatterns: ['/(^|/)BUILD(\\.[^/]+)?$/'],
};

// Requirements are read from the file the target names, so this manager can
// report whatever the manager that owns that format reports.
export const supportedDatasources = [
  PypiDatasource.id,
  GitTagsDatasource.id,
  GitRefsDatasource.id,
  GithubTagsDatasource.id,
  GithubReleasesDatasource.id,
  GitlabTagsDatasource.id,
  PythonVersionDatasource.id,
];
