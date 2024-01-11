import type { Category } from '../../../constants';
import { GoDatasource } from '../../datasource/go';

export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const supportedDatasources = [GoDatasource.id];

export const categories: Category[] = ['golang'];

export const defaultConfig = {
  fileMatch: [],
};
