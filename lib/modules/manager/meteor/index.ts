import { ProgrammingLanguage } from '../../../constants';
import { NpmDatasource } from '../../datasource/npm';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.JavaScript;

export const defaultConfig = {
  fileMatch: ['(^|/)package\\.js$'],
};

export const supportedDatasources = [NpmDatasource.id];
