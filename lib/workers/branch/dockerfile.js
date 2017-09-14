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
  logger.debug(`setNewValue: ${depName} = ${newVersion}`);
  const regexReplace = new RegExp(`(^|\n)FROM ${currentVersion}\n`);
  const newFileContent = currentFileContent.replace(
    regexReplace,
    `$1FROM ${newVersion}\n`
  );
  return newFileContent;
}
