import type { Category } from '../../../constants/index.ts';
import { VcpkgDatasource } from '../../datasource/vcpkg/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'vcpkg';
export const url = 'https://learn.microsoft.com/vcpkg/';
export const categories: Category[] = ['c'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)vcpkg\\.json$/'],
};

export const supportedDatasources = [VcpkgDatasource.id];
