import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'java';

export const defaultConfig = {
  fileMatch: ['(^|/)src/main/features/.+\\.json$'],
};

export const supportedDatasources = [MavenDatasource.id];
