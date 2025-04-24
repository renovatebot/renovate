import type { Category } from '../../../constants';
import { BuildpacksRegistryDatasource } from '../../datasource/buildpacks-registry';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  commitMessageTopic: 'buildpack {{depName}}',
  fileMatch: ['(^|/)project\\.toml$'],
  pinDigests: false,
};

export const categories: Category[] = ['docker', 'ci', 'cd'];
export const supportedDatasources = [
  DockerDatasource.id,
  BuildpacksRegistryDatasource.id,
];
