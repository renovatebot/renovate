module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  logger.trace(`updateDependency(${upgrade.depName})`);
  return fileContent;
}
