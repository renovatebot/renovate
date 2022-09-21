import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semver from '../../versioning/semver';

export { extractPackageFile } from './extract';

// Only from GitHub Releases: https://github.com/terraform-linters/tflint/blob/master/docs/developer-guide/plugins.md#4-creating-a-github-release
export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  commitMessageTopic: 'TFLint plugin {{depName}}',
  fileMatch: ['^\\.tflint\\.hcl$'],
  versioning: semver.id,
  extractVersion: '^v(?<version>.*)$',
};
