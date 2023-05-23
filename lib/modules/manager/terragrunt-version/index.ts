import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.terragrunt-version$'],
  filePatterns: ['**/.terragrunt-version'], // not used yet
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.+)$',
};
