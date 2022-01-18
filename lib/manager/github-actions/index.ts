import * as githubTagsDatasource from '../../datasource/github-tags';
import * as dockerVersioning from '../../versioning/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: [
    '(^workflow-templates|\\.github\\/workflows)\\/[^/]+\\.ya?ml$',
    '(^|\\/)action\\.ya?ml$',
  ],
};

export const supportedDatasources = [githubTagsDatasource.id, dockerVersioning.id];
