import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)Chart\\.ya?ml$'],
};

export const categories: Category[] = ['helm', 'kubernetes'];

export const supportedDatasources = [DockerDatasource.id, HelmDatasource.id];
