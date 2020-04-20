import { extractPackageFile } from './extract';
import * as semverVersioning from '../../versioning/semver';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.html?$'],
  versioning: semverVersioning.id,
  digest: {
    enabled: false,
  },
  pinDigests: false,
};
