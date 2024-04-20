import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GithubReleasesDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|/)\\.scalafmt.conf$'],
};

export const categories: Category[] = ['java'];
