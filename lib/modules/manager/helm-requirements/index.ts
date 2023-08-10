import type { Category } from '../../../constants';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  fileMatch: ['(^|/)requirements\\.ya?ml$'],
};

export const categories: Category[] = ['helm', 'kubernetes'];

export const supportedDatasources = [HelmDatasource.id];
