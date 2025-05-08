import type { Category } from '../../../constants';
import { GoDatasource } from '../../datasource/go';

export { extractPackageFile } from './extract';
export { bumpPackageVersion } from './update';

export const displayName = 'OpenTelemetry Collector Builder (ocb)';
export const url =
  'https://github.com/open-telemetry/opentelemetry-collector/tree/main/cmd/builder';
export const categories: Category[] = ['golang'];

export const defaultConfig = {
  managerFilePatterns: [],
};

export const supportedDatasources = [GoDatasource.id];
