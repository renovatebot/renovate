import type { Category } from '../../../constants';
import { GlasskubePackagesDatasource } from '../../datasource/glasskube-packages';

export { extractAllPackageFiles, extractPackageFile } from './extract';

export const url = 'https://glasskube.dev/docs';
export const categories: Category[] = ['kubernetes', 'cd'];

export const defaultConfig = {
  fileMatch: [],
};

export const supportedDatasources = [GlasskubePackagesDatasource.id];
