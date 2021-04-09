import * as semverVersioning from '../../versioning/semver';
import { extractPackageFile } from './extract';

export { extractPackageFile };

export const defaultConfig = {
  fileMatch: ['\\.html?$'],
  versioning: semverVersioning.id,
  digest: {
    enabled: false,
  },
  pinDigests: false,
};
