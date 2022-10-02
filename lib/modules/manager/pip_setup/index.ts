import { ProgrammingLanguage } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Python;

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.py$'],
};

export const supportedDatasources = [PypiDatasource.id];
