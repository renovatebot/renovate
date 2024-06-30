import { supportedDatasources as asdfSupportedDatasources } from '../asdf/index';

export { extractPackageFile } from './extract';

export const displayName = 'mise';

export const defaultConfig = {
  fileMatch: ['(^|/).mise.toml$'],
};

// Shares the same datasources as asdf as they both support the same plugins.
export const supportedDatasources = asdfSupportedDatasources;
