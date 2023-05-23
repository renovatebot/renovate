import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

// Only from GitHub Releases: https://github.com/terraform-linters/tflint/blob/master/docs/developer-guide/plugins.md#4-creating-a-github-release
export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  commitMessageTopic: 'TFLint plugin {{depName}}',
  fileMatch: ['\\.tflint\\.hcl$'],
  filePatterns: [
    '**/tflint.hcl',
    '**/.tflint.hcl',
    '**/*.tflint.hcl',
    '**/*_tflint.hcl',
  ], // not used yet
  extractVersion: '^v(?<version>.*)$',
};
