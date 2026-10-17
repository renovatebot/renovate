import type { Category } from '../../../constants/index.ts';
import { MavenDatasource } from '../../datasource/maven/index.ts';
import { id as versioning } from '../../versioning/gradle/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { knownDepTypes } from './dep-types.ts';
export { extractAllPackageFiles, extractPackageFile } from './extract.ts';

export const displayName = 'Kotlin Toolchain Wrapper';
export const url = 'https://kotlin-toolchain.org/latest/cli/provisioning/';
export const categories: Category[] = ['java'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)kotlin$/', '/(^|/)kotlin\\.bat$/'],
  versioning,
};

export const supportedDatasources = [MavenDatasource.id];
