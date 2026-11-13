import type { Category } from '../../../constants/index.ts';
import { JuliaDatasource } from '../../datasource/julia/index.ts';

export { knownDepTypes } from './dep-types.ts';
export { extractPackageFile } from './extract.ts';
export { getRangeStrategy } from './range.ts';

export const displayName = 'Julia';
export const url = 'https://pkgdocs.julialang.org/v1/compatibility/';
export const categories: Category[] = ['julia'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)(Julia)?Project\\.toml$/'],
};

export const supportedDatasources = [JuliaDatasource.id];
