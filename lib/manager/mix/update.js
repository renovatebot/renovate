function updateDependency(currentFileContent, upgrade) {
  try {
    logger.debug(`mix.updateDependency: ${upgrade.newValue}`);

    if (upgrade.depType !== 'hex') {
      logger.info('Unsupported dependency type');
      return null;
    }

    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    let newLine = lineToChange;

    newLine = lineToChange.replace(/"(.*?)"/, `"${upgrade.newValue}"`);

    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }

    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new mix module version');
    return null;
  }
}

module.exports = {
  updateDependency,
};
