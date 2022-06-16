import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.bazelversion$'],
  versioning: semverVersioning.id,
  pinDigests: false,
};

export const supportedDatasources = [GithubTagsDatasource.id];
