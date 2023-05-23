import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'java';

export const defaultConfig = {
  fileMatch: ['(^|/)src/main/features/.+\\.json$'],
  filePatterns: ['**/src/main/features/**/*.json'], // not used yet
};

export const supportedDatasources = [MavenDatasource.id];
