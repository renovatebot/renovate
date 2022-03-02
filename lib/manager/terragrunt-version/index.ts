import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as hashicorpVersioning from '../../modules/versioning/hashicorp';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.terragrunt-version$'],
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.+)$',
};
