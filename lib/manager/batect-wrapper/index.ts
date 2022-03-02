import { GithubReleasesDatasource } from '../../datasource/github-releases';
import { id as versioning } from '../../modules/versioning/semver';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)batect$'],
  versioning,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
