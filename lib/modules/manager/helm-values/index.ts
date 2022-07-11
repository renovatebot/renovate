import { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'helm values {{depName}}',
  fileMatch: ['(^|/)values\\.yaml$'],
  pinDigests: false,
};

export const categories = [Category.Helm];

export const supportedDatasources = [DockerDatasource.id];
