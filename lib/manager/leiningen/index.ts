import * as mavenVersioning from '../../versioning/maven';

export { extractPackageFile } from './extract';

export const defaultConfig = {
  fileMatch: ['(^|/)project\\.clj$'],
  versioning: mavenVersioning.id,
};
