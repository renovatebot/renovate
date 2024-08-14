import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'buildpacks project descriptor {{depName}}',
  fileMatch: ['(^|/)project\\.toml$'],
  pinDigests: false,
};

export const categories: Category[] = ['docker', 'buildpacks'];
export const supportedDatasources = [DockerDatasource.id];
