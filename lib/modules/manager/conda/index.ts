import { ProgrammingLanguage } from '../../../constants';
import { CondaDatasource } from '../../datasource/conda';
export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  enabled: false,
  fileMatch: ['(^|/)environment\\.ya?ml$'],
};

export const supportedDatasources = [CondaDatasource.id];
