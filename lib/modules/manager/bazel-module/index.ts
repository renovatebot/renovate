import { BazelDatasource } from '../../datasource/bazel';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['(^|/)MODULE\\.bazel$'],
  // The bazel-module manager is still under development. The milestone
  // tracking the release of this manager is at
  // https://github.com/renovatebot/renovate/issues/13658.
  enabled: false,
};

export const supportedDatasources = [
  BazelDatasource.id,
  GithubTagsDatasource.id,
];
