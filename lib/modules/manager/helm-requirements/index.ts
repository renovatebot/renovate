import type { Category } from '../../../constants';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const displayName = 'Helm v2 Chart Dependencies';
export const url =
  'https://v2.helm.sh/docs/developing_charts/#chart-dependencies';
export const categories: Category[] = ['helm', 'kubernetes'];

export const defaultConfig = {
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  managerFilePatterns: ['/(^|/)requirements\\.ya?ml$/'],
};

export const supportedDatasources = [HelmDatasource.id];
