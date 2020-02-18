import * as mavenVersioning from '../../versioning/maven';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: ['(^|/)deps\\.edn$'],
  versioning: mavenVersioning.id,
};
