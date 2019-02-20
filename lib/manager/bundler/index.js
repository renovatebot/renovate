const { extractPackageFile } = require('./extract');
const { updateDependency } = require('./update');
const { getArtifacts } = require('./artifacts');
const { getRangeStrategy } = require('./range');

const language = 'ruby';

/*
 * Each of the below functions contain some explanations within their own files.
 * The best way to understand them in more detail is to look at the existing managers and find one that matches most closely what you need to do.
 */

module.exports = {
  extractPackageFile, // Mandatory unless extractAllPackageFiles is used instead
  getArtifacts, // Optional
  getRangeStrategy, // Optional
  language, // Optional
  updateDependency, // Mandatory
};
