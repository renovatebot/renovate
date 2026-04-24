import { getConfigFileNames } from '../../../config/app-strings.ts';
import { allToolConfig } from '../../../util/exec/containerbase.ts';

export { extractPackageFile } from './extract.ts';

export const url = '../../../configuration-options.md#constraints';

export { knownDepTypes } from './dep-types.ts';

export const defaultConfig = {
  managerFilePatterns: getConfigFileNames().filter(
    (name) => name !== 'package.json',
  ),
};

export const supportedDatasources = Object.values(allToolConfig).map(
  (conf) => conf.datasource,
);
