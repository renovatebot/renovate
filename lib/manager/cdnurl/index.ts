import * as semverVersioning from '../../versioning/semver';
import { extractPackageFile } from './extract';
import { updateDependency } from './update';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: [],
  versioning: semverVersioning.id,
};
