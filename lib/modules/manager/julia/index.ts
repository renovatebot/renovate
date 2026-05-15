import type { Category } from '../../../constants/index.ts';
import { JuliaGeneralMetadataDatasource } from '../../datasource/julia-general-metadata/index.ts';

export { extractPackageFile } from './extract.ts';

export const displayName = 'Julia';
export const url = 'https://pkgdocs.julialang.org/v1/compatibility/';
export const categories: Category[] = ['julia'];

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)(Julia)?Project\\.toml$/'],
};

export const supportedDatasources = [JuliaGeneralMetadataDatasource.id];
