import type { Category } from '../../../constants/index.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { KubernetesApiDatasource } from '../../datasource/kubernetes-api/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://kubernetes.io/docs';
export const categories: Category[] = ['kubernetes'];

export const defaultConfig = {
  managerFilePatterns: [],
  updateVersionLabels: false,
};

export const supportedDatasources = [
  DockerDatasource.id,
  KubernetesApiDatasource.id,
];
