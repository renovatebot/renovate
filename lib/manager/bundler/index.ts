import { ProgrammingLanguage } from '../../constants';
import * as rubyVersioning from '../../versioning/ruby';
import { updateArtifacts } from './artifacts';
import { extractPackageFile } from './extract';
import { getRangeStrategy } from './range';
import { updateLockedDependency } from './update-locked';

const language = ProgrammingLanguage.Ruby;
export const supportsLockFileMaintenance = true;

/*
 * Each of the below functions contain some explanations within their own files.
 * The best way to understand them in more detail is to look at the existing managers and find one that matches most closely what you need to do.
 */

export {
  extractPackageFile, // Mandatory unless extractAllPackageFiles is used instead
  updateArtifacts, // Optional
  getRangeStrategy, // Optional
  language, // Optional
  updateLockedDependency,
};

export const defaultConfig = {
  fileMatch: ['(^|/)Gemfile$'],
  versioning: rubyVersioning.id,
};
