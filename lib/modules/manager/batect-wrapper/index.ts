import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { id as versioning } from '../../versioning/semver';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)batect$'],
  versioning,
};

export const categories: Category[] = ['batect'];

export const supportedDatasources = [GithubReleasesDatasource.id];
