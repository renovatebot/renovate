import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const url = 'https://docs.docker.com/build/concepts/dockerfile';
export const categories: Category[] = ['docker'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/|\\.)([Dd]ocker|[Cc]ontainer)file$/',
    '/(^|/)([Dd]ocker|[Cc]ontainer)file[^/]*$/',
  ],
};

export const supportedDatasources = [DockerDatasource.id];
