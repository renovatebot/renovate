import { extractPackageFile } from './extract';
import { updateDependency } from './update';
import { updateArtifacts } from './artifacts';
import { getRangeStrategy } from './range';

const language = 'ruby';

/*
 * Each of the below functions contain some explanations within their own files.
 * The best way to understand them in more detail is to look at the existing managers and find one that matches most closely what you need to do.
 */

export {
  extractPackageFile, // Mandatory unless extractAllPackageFiles is used instead
  updateArtifacts, // Optional
  getRangeStrategy, // Optional
  language, // Optional
  updateDependency, // Mandatory
};
