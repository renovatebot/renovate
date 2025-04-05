import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const displayName = '.terragrunt-version';
export const categories: Category[] = ['terraform'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.terragrunt-version$/'],
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.+)$',
};

export const supportedDatasources = [GithubReleasesDatasource.id];
