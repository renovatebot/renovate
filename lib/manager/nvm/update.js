module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade) {
  logger.debug(`nvm.setNewValue: ${upgrade.newVersions}`);
  return `${upgrade.newVersion}\n`;
}
