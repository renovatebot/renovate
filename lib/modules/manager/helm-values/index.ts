import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const url = 'https://helm.sh/docs/chart_template_guide/values_files';
export const categories: Category[] = ['helm', 'kubernetes'];

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  managerFilePatterns: ['/(^|/)values\\.ya?ml$/'],
  pinDigests: false,
};

export const supportedDatasources = [DockerDatasource.id];
