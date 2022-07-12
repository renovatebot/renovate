import type { Category, ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { KubernetesApiDatasource } from '../../datasource/kubernetes-api';

export { extractPackageFile } from './extract';

export const language: ProgrammingLanguage = 'docker';

export const defaultConfig = {
  fileMatch: [],
};

export const categories: Category[] = ['kubernetes'];

export const supportedDatasources = [
  DockerDatasource.id,
  KubernetesApiDatasource.id,
];
