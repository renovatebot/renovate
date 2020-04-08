import { extractPackageFile } from './extract';
import { updateArtifacts } from './artifacts';
import { getRangeStrategy } from './range';
import { LANGUAGE_PHP } from '../../constants/languages';
import * as composerVersioning from '../../versioning/composer';

const language = LANGUAGE_PHP;
export const supportsLockFileMaintenance = true;
export const autoReplace = true;

export { extractPackageFile, updateArtifacts, language, getRangeStrategy };

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)composer.json$'],
  versioning: composerVersioning.id,
};
