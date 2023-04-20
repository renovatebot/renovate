import { BazelRegistryDatasource } from '../../datasource/bazel-registry';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)MODULE\\.bazel$'],
};

export const supportedDatasources = [BazelRegistryDatasource.id];
