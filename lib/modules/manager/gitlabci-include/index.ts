import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.ya?ml$'],
  filePatterns: ['**/.gitlab-ci.{yml,yaml}'], // not used yet
};

export const supportedDatasources = [GitlabTagsDatasource.id];
