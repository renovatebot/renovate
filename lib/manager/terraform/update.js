module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  try {
    logger.debug(`terraform.updateDependency: ${upgrade.newValue}`);
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    let newLine = lineToChange;
    if (upgrade.depType === 'github') {
      if (!lineToChange.includes(upgrade.depNameShort)) {
        return null;
      }
      newLine = lineToChange.replace(/\?ref=.*"/, `?ref=${upgrade.newValue}"`);
    } else if (upgrade.depType === 'terraform') {
      if (!lineToChange.match(/version\s*=\s*"/)) {
        return null;
      }
      newLine = lineToChange.replace(
        /(version\s*=\s*)"[^"]*"/,
        `$1"${upgrade.newValue}"`
      );
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) /* istanbul ignore next */ {
    logger.info({ err }, 'Error setting new terraform module version');
    return null;
  }
}
