import { ProgrammingLanguage } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { KubernetesApiDatasource } from '../../datasource/kubernetes-api';

export { extractPackageFile } from './extract';

export const language = ProgrammingLanguage.Docker;

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [
  DockerDatasource.id,
  KubernetesApiDatasource.id,
];
