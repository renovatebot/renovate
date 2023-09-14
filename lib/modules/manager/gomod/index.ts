import type { Category } from '../../../constants';
import { GoDatasource } from '../../datasource/go';
import { GolangVersionDatasource } from '../../datasource/golang-version';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency, updateArtifacts };

export const displayName = 'Go Modules';
export const url = 'https://go.dev/ref/mod';

export const defaultConfig = {
  fileMatch: ['(^|/)go\\.mod$'],
  pinDigests: false,
};

export const categories: Category[] = ['golang'];

export const supportedDatasources = [
  GoDatasource.id,
  GolangVersionDatasource.id,
];
