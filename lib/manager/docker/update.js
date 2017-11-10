module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`setNewValue: ${upgrade.newFrom}`);
    const oldLine = new RegExp(
      `(^|\n)${upgrade.fromPrefix}(\\s+)${upgrade.depName}.*?(\\s?)${
        upgrade.fromSuffix
      }\n`
    );
    let newLine = `$1${upgrade.fromPrefix}$2${upgrade.newFrom}$3`;
    if (upgrade.fromSuffix.length) {
      newLine += `${upgrade.fromSuffix}`;
    }
    newLine += '\n';
    const newFileContent = currentFileContent.replace(oldLine, newLine);
    return newFileContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
