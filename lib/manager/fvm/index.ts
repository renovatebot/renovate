import { GithubTagsDatasource } from '../../datasource/github-tags';
import * as semverVersioning from '../../modules/versioning/semver';

export { extractPackageFile } from './extract';

export const supportedDatasources = [GithubTagsDatasource.id];

export const defaultConfig = {
  fileMatch: ['(^|\\/)\\.fvm\\/fvm_config\\.json$'],
  versioning: semverVersioning.id,
};
