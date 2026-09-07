import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { JenkinsPluginsDatasource } from '../../datasource/jenkins-plugins/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://www.jenkins.io/doc';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)plugins\\.(txt|ya?ml)$/'],
};

export const supportedDatasources: DatasourceName[] = [
  JenkinsPluginsDatasource.id,
];
