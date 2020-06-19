import { LANGUAGE_PERL } from '../../constants/languages';
import { extractPackageFile } from './extract';

const language = LANGUAGE_PERL;
export const supportsLockFileMaintenance = false;

export {
  extractPackageFile,
  // updateArtifacts,
  // getRangeStrategy,
  language,
};

export const defaultConfig = {
  fileMatch: ['(^|/)cpanfile$'],
  versioning: 'perl', // TODO: module
};
