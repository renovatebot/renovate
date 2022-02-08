import * as NpmDatasource from '../../datasource/npm';
import { PypiDatasource } from '../../datasource/pypi';
import { RubyVersionDatasource } from '../../datasource/ruby-version';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)\\.tool-versions$'],
};

export const supportedDatasources = [
  NpmDatasource.id,
  PypiDatasource.id,
  RubyVersionDatasource.id,
];
