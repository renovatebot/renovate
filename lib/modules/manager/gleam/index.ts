import { HexDatasource } from '../../datasource/hex/index.ts';
import * as hexVersioning from '../../versioning/hex/index.ts';

export { updateArtifacts } from './artifacts.ts';
export { extractPackageFile } from './extract.ts';
export { getRangeStrategy } from './range.ts';

export const url = 'https://gleam.run/documentation';

export const defaultConfig = {
  managerFilePatterns: ['/(^|/)gleam.toml$/'],
  versioning: hexVersioning.id,
};

export const supportsLockFileMaintenance = true;
export const lockFileNames = ['manifest.toml'];
export const supportedDatasources = [HexDatasource.id];
