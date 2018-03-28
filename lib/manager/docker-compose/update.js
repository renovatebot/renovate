module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`setNewValue: ${upgrade.newFrom}`);
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    const newLine = lineToChange.replace(
      /^(\s*image:\s*)[^\s]+(\s*)$/,
      `$1${upgrade.newFrom}$2`
    );
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
