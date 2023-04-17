import { PypiDatasource } from '../../datasource/pypi';
import * as pep440 from '../../versioning/pep440';

export { extractPackageFile } from './extract';
export { updateArtifacts } from './artifacts';

export const defaultConfig = {
  fileMatch: ['^.kraken.py$'],
  versioning: pep440.id,
};

export const supportedDatasources = [PypiDatasource.id];
export const supportsLockFileMaintenance = true;
