import type { Category } from '../../../constants/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';
export { extractPackageFile } from './extract.ts';

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
