import type { ProgrammingLanguage } from '../../../constants';
import { NpmDatasource } from '../../datasource/npm';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'js';

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.js$'],
  filePatterns: ['**/package.js'], // not used yet
};

export const supportedDatasources = [NpmDatasource.id];
