import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  commitMessageTopic: 'vendir {{depName}}',
  fileMatch: ['(^|/)vendir\\.yml$'],
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
export const supportsLockFileMaintenance = true;
