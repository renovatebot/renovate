const { dependencyPattern } = require('./extract');

module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(`pip_requirements.updateDependency(): ${upgrade.newValue}`);
    const lines = fileContent.split('\n');
    const oldValue = lines[upgrade.lineNumber];
    const newValue = oldValue.replace(
      new RegExp(dependencyPattern),
      `$1$2${upgrade.newValue}`
    );
    lines[upgrade.lineNumber] = newValue;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}
