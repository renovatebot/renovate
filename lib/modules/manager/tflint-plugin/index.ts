import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

export const categories: Category[] = ['terraform'];

// Only from GitHub Releases: https://github.com/terraform-linters/tflint/blob/master/docs/developer-guide/plugins.md#4-creating-a-github-release
export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  commitMessageTopic: 'TFLint plugin {{depName}}',
  fileMatch: ['\\.tflint\\.hcl$'],
  extractVersion: '^v(?<version>.*)$',
};
