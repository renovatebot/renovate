import type { Category } from '../../../constants/index.ts';
import { GoDatasource } from '../../datasource/go/index.ts';
import { GolangVersionDatasource } from '../../datasource/golang-version/index.ts';
import { updateArtifacts } from './artifacts.ts';
import { extractPackageFile } from './extract.ts';
import { updateDependency } from './update.ts';

export { extractPackageFile, updateDependency, updateArtifacts };

export const displayName = 'Go Modules';
export const url = 'https://go.dev/ref/mod';
export const categories: Category[] = ['golang'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)go\\.mod$/'],
  pinDigests: false,
};

export const supportedDatasources = [
  GoDatasource.id,
  GolangVersionDatasource.id,
];
