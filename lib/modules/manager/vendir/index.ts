import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';

export const categories: Category[] = ['helm', 'kubernetes'];

import { GitRefsDatasource } from '../../datasource/git-refs/index.ts';
import { GithubReleasesDatasource } from '../../datasource/github-releases/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['vendir.lock.yml'];
export const lockFileMaintenanceIsDelegatedToPackageManager = true;

export const displayName = 'vendir';
export const url = 'https://carvel.dev/vendir/docs/latest';

export const defaultConfig = {
  commitMessageTopic: 'vendir {{depName}}',
  managerFilePatterns: ['/(^|/)vendir\\.yml$/'],
};

export const supportedDatasources = [
  DockerDatasource.id,
  GithubReleasesDatasource.id,
  GitRefsDatasource.id,
  HelmDatasource.id,
];

export { knownDepTypes } from './dep-types.ts';
