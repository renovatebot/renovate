import { Category } from '../../../constants';
import { HelmDatasource } from '../../datasource/helm';
export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: [],
};

export const categories = [Category.Helm, Category.CD];

export const supportedDatasources = [HelmDatasource.id];
