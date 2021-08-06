import * as npmVersioning from '../../versioning/npm';

export { updateArtifacts } from './artifacts';
export { extractPackageFile } from './extract';

export const supportsLockFileMaintenance = true;

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: npmVersioning.id,
};
