import type { Category } from '../../../constants/index.ts';
import { BuildpacksRegistryDatasource } from '../../datasource/buildpacks-registry/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export { extractPackageFile } from './extract.ts';

export const defaultConfig = {
  commitMessageTopic: 'buildpack {{depName}}',
  managerFilePatterns: ['/(^|/)project\\.toml$/'],
  pinDigests: false,
};

export const categories: Category[] = ['docker', 'ci', 'cd'];
export const supportedDatasources = [
  DockerDatasource.id,
  BuildpacksRegistryDatasource.id,
];
