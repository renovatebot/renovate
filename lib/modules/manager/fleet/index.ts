import { GitTagsDatasource } from '../../datasource/git-tags';
import { HelmDatasource } from '../../datasource/helm';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)fleet\\.ya?ml'],
};

export const supportedDatasources = [GitTagsDatasource.id, HelmDatasource.id];
