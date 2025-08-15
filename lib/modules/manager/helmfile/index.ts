import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const supportsLockFileMaintenance = true;

export const url = 'https://helmfile.readthedocs.io';
export const categories: Category[] = ['cd', 'helm', 'kubernetes'];

export const defaultConfig = {
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
  commitMessageTopic: 'helm chart {{depName}}',
  managerFilePatterns: [
    '/(^|/)helmfile\\.ya?ml(?:\\.gotmpl)?$/',
    '/(^|/)helmfile\\.d/.+\\.ya?ml(?:\\.gotmpl)?$/',
  ],
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
