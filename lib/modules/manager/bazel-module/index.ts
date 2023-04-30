import { BazelDatasource } from '../../datasource/bazel';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)MODULE\\.bazel$'],
  // The bazel-module manager is still under development. The milestone
  // tracking the release of this manager is at
  // https://github.com/cgrindel/renovate_bzlmod_support/milestone/2.
  enabled: false,
};

export const supportedDatasources = [BazelDatasource.id];
