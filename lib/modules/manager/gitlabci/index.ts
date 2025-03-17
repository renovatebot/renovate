import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export { extractAllPackageFiles, extractPackageFile };

export const displayName = 'GitLab CI/CD';
export const url = 'https://docs.gitlab.com/ee/ci';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.ya?ml$'],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GitlabTagsDatasource.id,
];
