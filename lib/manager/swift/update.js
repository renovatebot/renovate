const { isVersion } = require('../../versioning/swift');

function updateDependency(fileContent, upgrade) {
  const { currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const oldVal = isVersion(currentValue) ? `"${currentValue}"` : currentValue;
  const newVal = isVersion(newValue) ? `"${newValue}"` : newValue;
  if (rightPart.indexOf(oldVal) === 0) {
    return leftPart + rightPart.replace(oldVal, newVal);
  }
  if (rightPart.indexOf(newVal) === 0) {
    return fileContent;
  }
  return null;
}

module.exports = {
  updateDependency,
};
