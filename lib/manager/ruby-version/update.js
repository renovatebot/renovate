module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  logger.debug(`ruby-version.updateDependency(): ${upgrade.newVersions}`);
  return `${upgrade.newValue}\n`;
}
