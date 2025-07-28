import type { Category } from '../../../constants';
import { JenkinsPluginsDatasource } from '../../datasource/jenkins-plugins';
export { extractPackageFile } from './extract';

export const url = 'https://www.jenkins.io/doc';
export const categories: Category[] = ['ci'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)plugins\\.(txt|ya?ml)$/'],
};

export const supportedDatasources = [JenkinsPluginsDatasource.id];
