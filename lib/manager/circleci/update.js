const { getNewFrom } = require('../dockerfile/update');

module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    if (upgrade.depType === 'docker') {
      const newFrom = getNewFrom(upgrade);
      logger.debug(`circleci.updateDependency(): ${newFrom}`);
      const imageLine = new RegExp(/^(\s*- image:\s*'?"?)[^\s'"]+('?"?\s*)$/);
      if (!lineToChange.match(imageLine)) {
        logger.debug('No image line found');
        return null;
      }
      const newLine = lineToChange.replace(imageLine, `$1${newFrom}$2`);
      if (newLine === lineToChange) {
        logger.debug('No changes necessary');
        return fileContent;
      }
      lines[upgrade.lineNumber] = newLine;
      return lines.join('\n');
    }
    if (upgrade.depType === 'orb') {
      const orbLine = new RegExp(`^(\\s+${upgrade.depName}:\\s[^@]+@).+$`);
      if (!lineToChange.match(orbLine)) {
        logger.debug('No image line found');
        return null;
      }
      const newLine = lineToChange.replace(orbLine, `$1${upgrade.newValue}`);
      if (newLine === lineToChange) {
        logger.debug('No changes necessary');
        return fileContent;
      }
      lines[upgrade.lineNumber] = newLine;
      return lines.join('\n');
    }
    logger.error('Unknown circleci depType');
    return null;
  } catch (err) {
    logger.info({ err }, 'Error setting new CircleCI image value');
    return null;
  }
}
