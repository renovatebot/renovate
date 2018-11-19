module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  logger.debug({ config: upgrade }, 'cargo.updateDependency()');
  // TODO
  return currentFileContent;
}
