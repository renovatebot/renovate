export { extractPackageFile } from './extract';
import { ConanDatasource } from '../../datasource/conan';
import * as conan from '../../versioning/conan';

export const defaultConfig = {
  fileMatch: ['(^|/)conanfile\\.(txt|py)$'],
  datasource: ConanDatasource.id,
  versioning: conan.id,
  rangeStrategy: 'bump',
  enabled: false, // See https://github.com/renovatebot/renovate/issues/14170
};

export const supportedDatasources = [ConanDatasource.id];
