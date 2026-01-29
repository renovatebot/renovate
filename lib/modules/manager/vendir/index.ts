import { DockerDatasource } from '../../datasource/docker/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
export { extractPackageFile } from './extract.ts';
export { updateArtifacts } from './artifacts.ts';

export const supportsLockFileMaintenance = true;

export const displayName = 'vendir';
export const url = 'https://carvel.dev/vendir/docs/latest';

export const defaultConfig = {
  commitMessageTopic: 'vendir {{depName}}',
  managerFilePatterns: ['/(^|/)vendir\\.yml$/'],
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
