module.exports = {
  extractPackageFile,
};

/*
 * The extractPackageFile() function is mandatory unless extractAllPackageFiles() is used instead.
 *
 * Use extractPackageFile() if it is OK for Renovate to parse/extract package files in parallel independently.
 *
 * Here are examples of when extractAllPackageFiles has been necessary to be used instead:
 *  - for npm/yarn/lerna, "monorepos" can have links between package files and logic requiring us to selectively ignore "internal" dependencies within the same repository
 *  - for gradle, we use a third party CLI tool to extract all dependencies at once and so it should not be called independently on each package file separately
 */

function extractPackageFile(content, fileName) {
  logger.trace(`bundler.extractPackageFile(${fileName})`);
  return null;
}
