import { extractPackageFile } from './extract';
import { updateDependency } from '../npm/update';
import { updateArtifacts } from './artifacts';
import { getRangeStrategy } from './range';
import { LANGUAGE_PHP } from '../../constants/languages';
import { VERSION_SCHEME_COMPOSER } from '../../constants/version-schemes';

const language = LANGUAGE_PHP;
export const supportsLockFileMaintenance = true;

export {
  extractPackageFile,
  updateArtifacts,
  language,
  updateDependency,
  getRangeStrategy,
};

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)composer.json$'],
  versioning: VERSION_SCHEME_COMPOSER,
};
