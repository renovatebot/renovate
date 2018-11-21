const { getDep, getInlineTableDep, getTableDep } = require('./extract');

module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  logger.debug({ config: upgrade }, 'cargo.updateDependency()');
  const { depName, depType, lineNumber, newValue } = upgrade;
  const lines = currentFileContent.split('\n');
  let dep;
  let currentValue;
  let versionLineNumber = lineNumber;
  const line = lines[lineNumber];
  if (depType === 'normal') {
    dep = getDep(line);
  } else if (depType === 'inlineTable') {
    dep = getInlineTableDep(line);
  } else if (depType === 'standardTable') {
    const match = line.match('dependencies[.]');
    dep = getTableDep(match, lines, lineNumber);
    if (dep) {
      versionLineNumber = dep.versionLineNumber;
    }
  }
  if (dep && !dep.skipReason) {
    currentValue = dep.currentValue;
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
