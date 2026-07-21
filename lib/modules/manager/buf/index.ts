import { BufPluginDatasource } from '../../datasource/buf-plugin/index.ts';

export { extractPackageFile } from './extract.ts';

export const url = 'https://buf.build/docs/generate/overview';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)buf\\.gen\\.ya?ml$/'],
};

export const supportedDatasources = [BufPluginDatasource.id];
