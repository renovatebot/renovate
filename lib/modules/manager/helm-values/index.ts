import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values\\.yaml$'],
  pinDigests: false,
};

export const categories: Category[] = ['helm'];

export const supportedDatasources = [DockerDatasource.id];
