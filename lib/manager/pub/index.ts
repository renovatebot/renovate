import * as npmVersioning from '../../versioning/npm';

export { extractPackageFile } from './extract';
export { updateDependency } from './update';

export const defaultConfig = {
  fileMatch: ['(^|/)pubspec\\.ya?ml$'],
  versioning: npmVersioning.id,
};
