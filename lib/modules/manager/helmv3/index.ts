import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { bumpPackageVersion } from './update.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['Chart.lock'];

export const displayName = 'Helm v3';
export const url = 'https://helm.sh/docs';
export const categories: Category[] = ['helm', 'kubernetes'];

export const defaultConfig = {
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  managerFilePatterns: ['/(^|/)Chart\\.ya?ml$/'],
};

export const supportedDatasources = [DockerDatasource.id, HelmDatasource.id];
