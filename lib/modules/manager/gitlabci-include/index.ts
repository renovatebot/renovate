import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.ya?ml$'],
};

export const supportedDatasources = [GitlabTagsDatasource.id];
