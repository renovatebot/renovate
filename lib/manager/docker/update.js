module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`setNewValue: ${upgrade.newFrom}`);
    const oldLine = new RegExp(
      `(^|\\n)${upgrade.fromPrefix}(\\s+)${upgrade.depName}[^\\s]*(\\s?)${
        upgrade.fromSuffix
      }\\n`
    );
    const newLine = `$1${upgrade.fromPrefix}$2${upgrade.newFrom}$3${
      upgrade.fromSuffix
    }\n`;
    const newFileContent = currentFileContent.replace(oldLine, newLine);
    return newFileContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
