import { supportedDatasources as asdfSupportedDatasources } from '../asdf';

export { extractPackageFile } from './extract';

export const displayName = 'mise';

export const defaultConfig = {
  fileMatch: ['(^|/)\\.?mise\\.toml$', '(^|/)\\.?mise/config\\.toml$'],
};

// Re-use the asdf datasources, as mise and asdf support the same plugins.
export const supportedDatasources = asdfSupportedDatasources;
