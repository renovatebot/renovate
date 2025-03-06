import type { Category } from '../../../constants';
import { DockerDatasource } from '../../datasource/docker';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const url = 'https://github.com/Praqma/helmsman#readme';
export const categories: Category[] = ['cd', 'helm', 'kubernetes'];

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [HelmDatasource.id, DockerDatasource.id];
