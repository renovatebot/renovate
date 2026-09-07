import type { Category } from '../../../constants/index.ts';
import type { DatasourceName } from '../../../datasource-list.generated.ts';
import { GoDatasource } from '../../datasource/go/index.ts';

export { extractPackageFile } from './extract.ts';
export { bumpPackageVersion } from './update.ts';

export const displayName = 'OpenTelemetry Collector Builder (ocb)';
export const url =
  'https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder';
export const categories: Category[] = ['golang'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources: DatasourceName[] = [GoDatasource.id];

export { knownDepTypes } from './dep-types.ts';
