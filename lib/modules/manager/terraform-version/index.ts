import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as hashicorpVersioning from '../../versioning/hashicorp';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.terraform-version$'],
  versioning: hashicorpVersioning.id,
  extractVersion: '^v(?<version>.*)$',
};

export const categories: Category[] = ['terraform'];
