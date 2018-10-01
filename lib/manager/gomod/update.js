module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  try {
    logger.debug(`gomod.updateDependency: ${upgrade.newValue}`);
    if (upgrade.updateType === 'major' && upgrade.newMajor > 1) {
      logger.warn('Skipping major gomod upgrade');
      return currentFileContent;
    }
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    if (!lineToChange.includes(upgrade.depName)) {
      return null;
    }
    let requireLine;
    if (upgrade.multiLine) {
      requireLine = new RegExp(/^(\s+[^\s]+\s+)[^\s]+/);
    } else {
      requireLine = new RegExp(/^(require\s+[^\s]+\s+)[^\s]+/);
    }
    if (!lineToChange.match(requireLine)) {
      logger.debug('No image line found');
      return null;
    }
    const newLine = lineToChange.replace(requireLine, `$1${upgrade.newValue}`);
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new go.mod version');
    return null;
  }
}
