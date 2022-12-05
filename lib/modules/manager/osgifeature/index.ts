import type { ProgrammingLanguage } from '../../../constants';
import { MavenDatasource } from '../../datasource/maven';
import * as mavenVersioning from '../../versioning/maven';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'java';

export const defaultConfig = {
  fileMatch: ['(^|/)src/main/features/.+\\.json$'],
  versioning: mavenVersioning.id,
};

export const supportedDatasources = [MavenDatasource.id];

export const displayName = 'osgifeature';
