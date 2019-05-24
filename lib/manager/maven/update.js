module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  const offset = fileContent.indexOf('<');
  const { currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, offset + fileReplacePosition);
  const rightPart = fileContent.slice(offset + fileReplacePosition);
  const versionClosePosition = rightPart.indexOf('</');
  const restPart = rightPart.slice(versionClosePosition);
  const versionPart = rightPart.slice(0, versionClosePosition);
  const version = versionPart.trim();
  if (version === newValue) {
    return fileContent;
  }
  if (version === currentValue) {
    const replacedPart = versionPart.replace(currentValue, newValue);
    return leftPart + replacedPart + restPart;
  }
  return null;
}
