import * as semverVersioning from '../../versioning/semver';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: [],
  versioning: semverVersioning.id,
};
