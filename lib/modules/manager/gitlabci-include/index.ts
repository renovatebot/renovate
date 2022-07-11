import { Category } from '../../../constants';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

export const categories = [Category.CI];

export const supportedDatasources = [GitlabTagsDatasource.id];
