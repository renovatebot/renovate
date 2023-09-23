import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values\\.ya?ml$'],
  pinDigests: false,
};

export const categories: Category[] = ['helm', 'kubernetes'];

export const supportedDatasources = [DockerDatasource.id];
