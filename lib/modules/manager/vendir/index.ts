import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const displayName = 'vendir';
export const url = 'https://carvel.dev/vendir/docs/latest';

export const defaultConfig = {
  commitMessageTopic: 'vendir {{depName}}',
  managerFilePatterns: ['/(^|/)vendir\\.yml$/'],
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
