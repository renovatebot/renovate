import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [
    '(^|\\/)(workflow-templates|\\.github\\/workflows)\\/[^/]+\\.ya?ml$',
    '(^|\\/)action\\.ya?ml$',
  ],
};

export const supportedDatasources = [
  GithubTagsDatasource.id,
  dockerVersioning.id,
];
