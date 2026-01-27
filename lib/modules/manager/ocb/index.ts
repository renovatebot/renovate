import type { Category } from '../../../constants/index.ts';
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

export const supportedDatasources = [GoDatasource.id];
