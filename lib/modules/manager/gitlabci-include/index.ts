import type { Category } from '../../../constants';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.yml$'],
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [GitlabTagsDatasource.id];
