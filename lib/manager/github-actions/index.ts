import * as githubTagsDatasource from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [
    '(^workflow-templates|\\.github\\/workflows)\\/[^/]+\\.ya?ml$',
    '(^|\\/)action\\.ya?ml$',
  ],
};

export const supportedDatasources = [
  githubTagsDatasource.id,
  dockerVersioning.id,
];
