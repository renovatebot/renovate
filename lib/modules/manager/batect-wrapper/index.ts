import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { id as versioning } from '../../versioning/semver';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)batect$'],
  filePatterns: ['**/batect'], // not used yet
  versioning,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
