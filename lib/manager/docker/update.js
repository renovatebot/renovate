module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade, logger) {
  const { fromLine, currentFrom, newFrom, depName } = upgrade;
  try {
    logger.debug({ currentFrom, newFrom }, 'Updating version in Dockerfile');
    logger.debug(`setNewValue: ${depName} = ${newFrom}`);
    const newFromLine = fromLine.replace(currentFrom, newFrom);
    logger.debug({ newFromLine }, 'new from line');
    const regexReplace = new RegExp(`(^|\n)${fromLine}\n`);
    const newFileContent = currentFileContent.replace(
      regexReplace,
      `$1${newFromLine}\n`
    );
    return newFileContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
