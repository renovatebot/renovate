import type { Category } from '../../../constants';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { bumpPackageVersion } from '../pep621/update';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const url = 'https://github.com/prefix-dev/pixi/';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  fileMatch: [
    '(^|/)pyproject\\.toml$', // `tool.pixi` section
    '(^|/)pixi\\.toml$', // root object
  ],
};

export const supportedDatasources = [];
