import type { Category, ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)\\.drone\\.yml$'],
};

export const categories: Category[] = ['ci'];

export const supportedDatasources = [DockerDatasource.id];
