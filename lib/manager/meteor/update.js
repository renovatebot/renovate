module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  const { depName, currentValue, newVersion } = upgrade;
  logger.debug(`meteor.updateDependency(): ${depName} = ${newVersion}`);
  const regexReplace = new RegExp(
    `('|")(${depName})('|"):(\\s+)('|")${currentValue}('|")`
  );
  const newFileContent = fileContent.replace(
    regexReplace,
    `$1$2$3:$4$5${newVersion}$6`
  );
  return newFileContent;
}
