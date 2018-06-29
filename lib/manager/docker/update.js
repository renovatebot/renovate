module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  const { fromPrefix, newFrom, fromSuffix } = upgrade;
  try {
    logger.debug(`docker.updateDependency(): ${upgrade.newFrom}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    const imageLine = new RegExp(/^FROM /i);
    if (!lineToChange.match(imageLine)) {
      logger.debug('No image line found');
      return null;
    }
    const newLine = `${fromPrefix} ${newFrom} ${fromSuffix}`.trim();
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
