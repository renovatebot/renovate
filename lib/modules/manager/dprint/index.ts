import type { Category } from '../../../constants/index.ts';
import { NpmDatasource } from '../../datasource/npm/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'dprint';
export const url = 'https://dprint.dev/config/';
export const categories: Category[] = [];

export const defaultConfig = {
  managerFilePatterns: [
    '/(^|/)dprint\\.jsonc?$/',
    '/(^|/)\\.dprint\\.jsonc?$/',
  ],
};

export const supportedDatasources = [NpmDatasource.id];
