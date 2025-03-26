import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

export const displayName = 'TFLint Plugins';
export const url =
  'https://github.com/terraform-linters/tflint/blob/master/docs/user-guide/plugins.md';
export const categories: Category[] = ['terraform'];

export const defaultConfig = {
  commitMessageTopic: 'TFLint plugin {{depName}}',
  managerFilePatterns: ['/\\.tflint\\.hcl$/'],
  extractVersion: '^v(?<version>.*)$',
};

// Only from GitHub Releases: https://github.com/terraform-linters/tflint/blob/master/docs/developer-guide/plugins.md#4-creating-a-github-release
export const supportedDatasources = [GithubReleasesDatasource.id];
