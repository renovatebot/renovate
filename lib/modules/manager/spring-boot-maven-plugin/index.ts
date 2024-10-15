import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/|\\.)pom\\.xml$'],
  versioning: DockerDatasource.id,
};

export const categories: Category[] = ['java', 'docker'];

export const supportedDatasources = [DockerDatasource.id];
