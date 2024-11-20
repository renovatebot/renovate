import { HexDatasource } from '../../datasource/hex';
import * as hexVersioning from '../../versioning/hex';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';
export { getRangeStrategy } from './range';

export const url = 'https://gleam.run/documentation';

export const defaultConfig = {
  fileMatch: ['(^|/)gleam.toml$'],
  versioning: hexVersioning.id,
};

export const supportsLockFileMaintenance = true;
export const supportedDatasources = [HexDatasource.id];
