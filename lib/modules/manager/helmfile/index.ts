import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)helmfile\\.yaml$'],
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
