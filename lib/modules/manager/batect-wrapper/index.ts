import type { Category } from '../../../constants/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { id as versioning } from '../../versioning/semver/index.ts';

export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './artifacts.ts';

export const categories: Category[] = ['batect'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)batect$/'],
  versioning,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
