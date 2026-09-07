import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { DockerDatasource } from '../../datasource/docker/index.ts';
import { HelmDatasource } from '../../datasource/helm/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://github.com/Praqma/helmsman#readme';
export const categories: Category[] = ['cd', 'helm', 'kubernetes'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources: DatasourceName[] = [
  HelmDatasource.id,
  DockerDatasource.id,
];
