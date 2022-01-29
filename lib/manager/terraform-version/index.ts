import * as datasourceGitHubRelease from '../../datasource/github-releases';
import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const supportedDatasources = [datasourceGitHubRelease.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.terraform-version$'],
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.*)$',
};
