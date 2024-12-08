import type { Category } from '../../../constants';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'GitLab CI/CD include';
export const url = 'https://docs.gitlab.com/ee/ci/yaml/includes.html';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.ya?ml$'],
};

export const supportedDatasources = [GitlabTagsDatasource.id];
