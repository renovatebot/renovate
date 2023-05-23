import { GithubTagsDatasource } from '../../datasource/github-tags';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [
    '^(workflow-templates|\\.github/workflows)/[^/]+\\.ya?ml$',
    '(^|/)action\\.ya?ml$',
  ],
  filePatterns: [
    '.github/workflows/*.{yml,yaml}',
    'workflow-templates/*.{yml,yaml}',
    '**/action.{yml,yaml}',
  ], // not used yet
};

export const supportedDatasources = [GithubTagsDatasource.id];
