import { extractPackageFile } from './extract';
import { updateDependency } from '../npm/update';
import { updateArtifacts } from './artifacts';
import { getRangeStrategy } from './range';
import { LANGUAGE_PHP } from '../../constants/languages';

const language = LANGUAGE_PHP;
export const supportsLockFileMaintenance = true;

export {
  extractPackageFile,
  updateArtifacts,
  language,
  updateDependency,
  getRangeStrategy,
};
