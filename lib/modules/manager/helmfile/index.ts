import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)helmfile\\.ya?ml$'],
  filePatterns: ['**/helmfile.{yml,yaml}'], // not used yet
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
