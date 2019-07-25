import { extractPackageFile } from './extract';
import { updateDependency } from '../npm/update';
import { updateArtifacts } from './artifacts';
import { getRangeStrategy } from './range';

const language = 'php';
export const supportsLockFileMaintenance = true;

export {
  extractPackageFile,
  updateArtifacts,
  language,
  updateDependency,
  getRangeStrategy,
};
