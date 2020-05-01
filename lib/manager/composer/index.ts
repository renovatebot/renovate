import { LANGUAGE_PHP } from '../../constants/languages';
import * as composerVersioning from '../../versioning/composer';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { getRangeStrategy } from './range';

const language = LANGUAGE_PHP;
export const supportsLockFileMaintenance = true;

export { extractPackageFile, updateArtifacts, language, getRangeStrategy };

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)composer.json$'],
  versioning: composerVersioning.id,
};
