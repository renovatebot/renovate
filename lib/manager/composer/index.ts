import { ProgrammingLanguage } from '../../constants';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { getRangeStrategy } from './range';
import { composerVersioningId } from './utils';

const language = ProgrammingLanguage.PHP;
export const supportsLockFileMaintenance = true;

export { extractPackageFile, updateArtifacts, language, getRangeStrategy };

export const defaultConfig = {
  fileMatch: ['(^|/)([\\w-]*)composer.json$'],
  versioning: composerVersioningId,
};
