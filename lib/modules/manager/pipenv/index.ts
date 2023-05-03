import type { ProgrammingLanguage } from '../../../constants';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const language: ProgrammingLanguage = 'python';
export const supportsLockFileMaintenance = true;

export const supportedDatasources = [
  PypiDatasource.id,
  GitTagsDatasource.id,
  GithubTagsDatasource.id,
];

export const defaultConfig = {
  fileMatch: ['(^|/)Pipfile$'],
};
