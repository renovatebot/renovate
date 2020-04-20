import { extractPackageFile } from './extract';
import { updateArtifacts } from './artifacts';
import { getRangeStrategy } from './range';
import { LANGUAGE_RUBY } from '../../constants/languages';
import * as rubyVersioning from '../../versioning/ruby';

const language = LANGUAGE_RUBY;
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
};

export const defaultConfig = {
  fileMatch: ['(^|/)Gemfile$'],
  versioning: rubyVersioning.id,
};
