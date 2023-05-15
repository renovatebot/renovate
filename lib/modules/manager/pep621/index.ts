import { PypiDatasource } from '../../datasource/pypi';
export { extractPackageFile } from './extract';

export const supportedDatasources = [PypiDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)pyproject\\.toml$'],
};
