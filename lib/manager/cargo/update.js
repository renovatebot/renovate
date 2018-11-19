const { getDep, getInlineTableDep, getTableDep } = require('./extract');

module.exports = {
  updateDependency,
};

// FIXME: Currently this function just replaces currentValue with newValue at
//        number line without checking if it is the right dependency
// TODO: Add more tests
function updateDependency(currentFileContent, upgrade) {
  logger.debug({ config: upgrade }, 'cargo.updateDependency()');
  const { depName, depType, lineNumber, newValue } = upgrade;
  const lines = currentFileContent.split('\n');
  if (depType === 'normal') {
    const line = lines[lineNumber];
    const currentValue = getDep(line).currentValue;
    lines[lineNumber] = line.replace(currentValue, newValue);
  } else if (depType == 'inlineTable') {
    const line = lines[lineNumber];
    const currentValue = getInlineTableDep(line).currentValue;
    lines[lineNumber] = line.replace(currentValue, newValue);
  } else if (depType == 'standardTable') {
    const match = line.match('dependencies[.]');
    const dep = getTableDep(match, lines, lineNumber);
    const currentValue = dep.currentValue;
    const versionLineNumber = dep.versionLineNumber;
    lines[versionLineNumber] = lines[versionLineNumber].replace(currentValue, newValue);
  }
  return lines.join('\n');
}
