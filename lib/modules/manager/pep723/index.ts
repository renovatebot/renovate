import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';
export { extractPackageFile } from './extract';

export const displayName = 'PEP 723';
export const url = 'https://peps.python.org/pep-0723';
export const categories: Category[] = ['python'];

export const defaultConfig = {
  // Since any Python file can embed PEP 723 metadata, make the feature opt-in, to avoid parsing all Python files.
  fileMatch: [],
};

export const supportedDatasources = [PypiDatasource.id];
