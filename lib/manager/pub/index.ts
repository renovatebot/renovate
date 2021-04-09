import * as npmVersioning from '../../versioning/npm';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: npmVersioning.id,
};
