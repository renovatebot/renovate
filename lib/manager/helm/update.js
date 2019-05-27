module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  logger.trace('updateDependency()');
  logger.trace(`${upgrade}`);
  return fileContent;
}
