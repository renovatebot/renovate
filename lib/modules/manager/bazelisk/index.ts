import { GithubReleasesDatasource } from '../../datasource/github-releases';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.bazelversion$'],
  versioning: semverVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [GithubReleasesDatasource.id];
