import { TypstDatasource } from '../../datasource/typst';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'Typst package';

export const defaultConfig = {
  managerFilePatterns: ['/\\.typ$/'],
};

export const supportedDatasources = [TypstDatasource.id];
