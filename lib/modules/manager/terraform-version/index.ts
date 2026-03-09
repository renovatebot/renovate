import type { Category } from '../../../constants/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import * as hashicorpVersioning from '../../versioning/hashicorp/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = '.terraform-version';
export const categories: Category[] = ['terraform'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)\\.terraform-version$/'],
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.*)$',
};

export const supportedDatasources = [GithubReleasesDatasource.id];
