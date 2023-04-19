import { GithubTagsDatasource } from '../../datasource/github-tags';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [
    '^(workflow-templates|\\.github/workflows)/[^/]+\\.ya?ml$',
    '(^|/)action\\.ya?ml$',
  ],
};

export const supportedDatasources = [GithubTagsDatasource.id];
