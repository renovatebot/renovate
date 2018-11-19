const { getDep, getInlineTableDep, getTableDep } = require('./extract');

module.exports = {
  updateDependency,
};

// TODO: Add more tests
// TODO: Refactor
function updateDependency(currentFileContent, upgrade) {
  logger.debug({ config: upgrade }, 'cargo.updateDependency()');
  const { depName, depType, lineNumber, newValue } = upgrade;
  const lines = currentFileContent.split('\n');
  if (depType === 'normal') {
    const line = lines[lineNumber];
    const dep = getDep(line);
    const currentValue = dep.currentValue;
    if (dep.depName.match(depName)) {
      lines[lineNumber] = line.replace(currentValue, newValue);
    } else {
      logger.debug(dep, upgrade, 'Invalid upgrade.lineNumber');
    }
  } else if (depType === 'inlineTable') {
    const line = lines[lineNumber];
    const dep = getInlineTableDep(line);
    const currentValue = dep.currentValue;
    if (dep.depName.match(depName)) {
      lines[lineNumber] = line.replace(currentValue, newValue);
    } else {
      logger.debug(dep, upgrade, 'Invalid upgrade.lineNumber');
    }
  } else if (depType === 'standardTable') {
    const line = lines[lineNumber];
    const match = line.match('dependencies[.]');
    const dep = getTableDep(match, lines, lineNumber);
    const currentValue = dep.currentValue;
    const versionLineNumber = dep.versionLineNumber;
    if (dep.depName.match(depName)) {
      lines[versionLineNumber] = lines[versionLineNumber].replace(
        currentValue,
        newValue
      );
    } else {
      logger.debug(dep, upgrade, 'Invalid upgrade.lineNumber');
    }
  }
  return lines.join('\n');
}
