import type { Category } from '../../../constants/index.ts';
import { GlasskubePackagesDatasource } from '../../datasource/glasskube-packages/index.ts';

export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export const url = 'https://glasskube.dev/docs';
export const categories: Category[] = ['kubernetes', 'cd'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources = [GlasskubePackagesDatasource.id];
