import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile, updateDependency };

export const defaultConfig = {
  fileMatch: ['\\.html?$'],
  versioning: semverVersioning.id,
  digest: {
    enabled: false,
  },
};
