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
  const regexReplace = new RegExp(
    `('|")(${depName})('|"):(\\s+)('|")${currentVersion}('|")`
  );
  const newFileContent = currentFileContent.replace(
    regexReplace,
    `$1$2$3:$4$5${newVersion}$6`
  );
  return newFileContent;
}
