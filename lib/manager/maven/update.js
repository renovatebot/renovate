module.exports = {
  updateAtPosition,
  updateDependency,
};

function updateAtPosition(fileContent, upgrade, endingAnchor = '"') {
  const { currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const versionClosePosition = rightPart.indexOf(endingAnchor);
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

function updateDependency(fileContent, upgrade) {
  const offset = fileContent.indexOf('<');
  const spaces = fileContent.slice(0, offset);
  const restContent = fileContent.slice(offset);
  const updatedContent = updateAtPosition(restContent, upgrade, '</');
  if (!updatedContent) return null;
  if (updatedContent === restContent) return fileContent;
  return `${spaces}${updatedContent}`;
}
