import { id as githubReleaseDatasource } from '../../datasource/github-releases';
import { id as versioning } from '../../versioning/semver';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['(^|/)batect$'],
  versioning,
};

export const supportedDatasources = [githubReleaseDatasource];
