import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['helmfile.lock'];

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
