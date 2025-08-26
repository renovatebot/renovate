import { TypstDatasource } from '../../datasource/typst';
import { id as versioning } from '../../versioning/semver-coerced';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const displayName = 'Typst package';

export const defaultConfig = {
  managerFilePatterns: ['/\\.typ$/'],
  versioning,
};

export const supportedDatasources = [TypstDatasource.id];
