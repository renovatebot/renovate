import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { TypstDatasource } from '../../datasource/typst/index.ts';
import { extractPackageFile } from './extract.ts';

export { extractPackageFile };

export const displayName = 'Typst package';

export const defaultConfig = {
  managerFilePatterns: ['/\\.typ$/'],
};

export const supportedDatasources: DatasourceName[] = [TypstDatasource.id];
