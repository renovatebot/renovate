module.exports = {
  updateDependency,
};

/*
 * The updateDependency() function is mandatory, and is used for updating one dependency at a time.
 * It returns the currentFileContent if no changes are necessary (e.g. because the existing branch/PR is up to date),
 * or with new content if changes are necessary.
 */

function updateDependency(currentFileContent, upgrade) {
  try {
    let returnNull = false;
    const updateLine = lineNumber => {
      const lineToChange = lines[lineNumber];
      if (!lineToChange.includes(upgrade.depName)) {
        logger.debug('No gem match on line');
        returnNull = true;
        return;
      }
      const newValue = upgrade.newValue
        .split(',')
        .map(part => `, "${part.trim()}"`)
        .join('');
      const newLine = lineToChange.replace(
        /(gem "[^"]+")(,\s+"[^"]+"){0,2}/,
        `$1${newValue}`
      );
      lines[lineNumber] = newLine;
    };
    const lines = currentFileContent.split('\n');
    for (const ln of upgrade.lineNumbers) {
      updateLine(ln - 1);
    }
    if (returnNull) {
      return null;
    }
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Gemfile value');
    return null;
  }
}
