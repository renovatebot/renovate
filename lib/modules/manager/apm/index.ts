import { GitTagsDatasource } from '../../datasource/git-tags/index.ts';
import { GithubTagsDatasource } from '../../datasource/github-tags/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const displayName = 'APM';
export const url = 'https://github.com/microsoft/apm';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['apm.lock.yaml'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)apm\\.ya?ml$/'],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  GitlabTagsDatasource.id,
  GitTagsDatasource.id,
];
