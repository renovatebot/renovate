import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractAllPackageFiles, extractPackageFile } from './extract';

export { extractAllPackageFiles, extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.gitlab-ci\\.ya?ml$'],
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [DockerDatasource.id];
