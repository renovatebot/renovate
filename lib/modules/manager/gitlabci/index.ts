import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags/index.ts';
import { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export { knownDepTypes } from './dep-types.ts';

export { extractAllPackageFiles, extractPackageFile };

export const displayName = 'GitLab CI/CD';
export const url = 'https://docs.gitlab.com/ee/ci';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/\\.gitlab-ci\\.ya?ml$/'],
};

export const supportedDatasources: DatasourceName[] = [
  DockerDatasource.id,
  GitlabTagsDatasource.id,
];
