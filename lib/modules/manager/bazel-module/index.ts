import { BazelDatasource } from '../../datasource/bazel';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)MODULE\\.bazel$'],
};

export const supportedDatasources = [BazelDatasource.id];
