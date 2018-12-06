module.exports = {
  updateDependency,
};

/*
 * The updateDependency() function is mandatory, and is used for updating one dependency at a time.
 * It returns the currentFileContent if no changes are necessary (e.g. because the existing branch/PR is up to date),
 * or with new content if changes are necessary.
 */

function updateDependency(currentFileContent, upgrade) {
  logger.debug({ config: upgrade }, 'bundler.updateDependency()');
  // TODO
  return currentFileContent;
}
