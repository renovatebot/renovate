import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { id as versioning } from '../../versioning/gradle/index.ts';

export { knownDepTypes, supportsDynamicDepTypesNote } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';
export { extractAllPackageFiles } from './extract-all.ts';

export const displayName = 'Kotlin Toolchain';
export const url = 'https://kotlin-toolchain.org/latest/reference/module/';
export const categories: Category[] = ['java'];
export const supersedesManagers = ['gradle'];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)module\\.yaml$/',
    '/(^|/)project\\.yaml$/',
    '/\\.module-template\\.yaml$/',
    '/(^|/)libs\\.versions\\.toml$/',
  ],
  versioning,
};

export const supportedDatasources = [MavenDatasource.id];
