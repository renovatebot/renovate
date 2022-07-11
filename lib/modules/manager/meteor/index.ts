import type { Category, ProgrammingLanguage } from '../../../constants';
import { NpmDatasource } from '../../datasource/npm';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'js';

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.js$'],
};

export const categories = [Category.JavaScript];

export const supportedDatasources = [NpmDatasource.id];
