import type { Category, ProgrammingLanguage } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'python';

export const defaultConfig = {
  fileMatch: ['(^|/)setup\\.py$'],
};

export const categories = [Category.Python];

export const supportedDatasources = [PypiDatasource.id];
