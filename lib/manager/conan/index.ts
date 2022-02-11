export { extractPackageFile } from './extract';
import { ConanDatasource } from '../../datasource/conan';
import * as conan from '../../versioning/conan';

export const defaultConfig = {
  fileMatch: ['(^|/)conanfile\\.(txt|py)$'],
  datasource: ConanDatasource.id,
  versioning: conan.id,
  rangeStrategy: 'bump',
};

export const supportedDatasources = [ConanDatasource.id];
