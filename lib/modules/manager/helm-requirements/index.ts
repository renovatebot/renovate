import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  aliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)requirements\\.yaml$'],
};

export const supportedDatasources = [HelmDatasource.id];
