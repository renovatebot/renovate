import type { Category } from '../../../constants';
import { PypiDatasource } from '../../datasource/pypi';
export { extractPackageFile } from './extract';

export const supportedDatasources = [PypiDatasource.id];

export const categories: Category[] = ['python'];

export const defaultConfig = {
  // Since any Python file can embed PEP 723 metadata, make the feature opt-in, to avoid parsing all Python files.
  fileMatch: [],
};
