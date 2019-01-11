module.exports = {
  updateDependency,
};

/*
 * The updateDependency() function is mandatory, and is used for updating one dependency at a time.
 * It returns the currentFileContent if no changes are necessary (e.g. because the existing branch/PR is up to date),
 * or with new content if changes are necessary.
 */

function updateDependency(currentFileContent, upgrade) {
  try {
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    if (!lineToChange.includes(upgrade.depName)) {
      logger.debug('No gem match on line');
      return null;
    }
    // TODO: support complex range replacement
    const newLine = lineToChange.replace(
      /(gem "[^"]+",\s+")[^"]+/,
      `$1${upgrade.newValue}`
    );
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Gemfile value');
    return null;
  }
}
