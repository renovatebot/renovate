import type { ProgrammingLanguage } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'python';

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.py$'],
  filePatterns: ['**/setup.py'], // not used yet
};

export const supportedDatasources = [PypiDatasource.id];
