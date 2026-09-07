import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { KubernetesApiDatasource } from '../../datasource/kubernetes-api/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://kubernetes.io/docs';
export const categories: Category[] = ['kubernetes'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources: DatasourceName[] = [
  DockerDatasource.id,
  KubernetesApiDatasource.id,
];
