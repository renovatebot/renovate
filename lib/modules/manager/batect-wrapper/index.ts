import type { Category } from '../../../constants';
import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { id as versioning } from '../../versioning/semver';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const categories: Category[] = ['batect'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)batect$/'],
  versioning,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
