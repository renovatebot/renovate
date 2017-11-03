module.exports = {
  setNewValue,
};

function setNewValue(
  currentFileContent,
  depName,
  currentVersion,
  newVersion,
  logger
) {
  try {
    logger.debug(`setNewValue: ${depName} = ${newVersion}`);
    const regexReplace = new RegExp(`(^|\n)FROM ${depName}.*?\n`);
    const newFileContent = currentFileContent.replace(
      regexReplace,
      `$1FROM ${newVersion}\n`
    );
    return newFileContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
