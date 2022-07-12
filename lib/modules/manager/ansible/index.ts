import type { Category, ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export const categories: Category[] = ['ansible', 'iac'];

export const defaultConfig = {
  fileMatch: ['(^|/)tasks/[^/]+\\.ya?ml$'],
};

export const supportedDatasources = [DockerDatasource.id];
