import { HelmDatasource } from '../../datasource/helm';
import { DockerDatasource } from '../../datasource/docker';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  aliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)helmfile.yaml$'],
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
