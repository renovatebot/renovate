import type { Category } from '../../../constants';
import { GlasskubePackagesDatasource } from '../../datasource/glasskube-packages';
import * as GlasskubeVersioning from '../../versioning/glasskube';

export { extractAllPackageFiles, extractPackageFile } from './extract';
export const defaultConfig = {
  fileMatch: [],
};
export const categories: Category[] = ['kubernetes', 'cd'];
export const supportedDatasources = [GlasskubePackagesDatasource.id];
