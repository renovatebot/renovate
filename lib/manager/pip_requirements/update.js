module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(`pip_requirements.updateDependency(): ${upgrade.newVersion}`);
    const lines = fileContent.split('\n');
    lines[upgrade.lineNumber] = `${upgrade.depName}==${upgrade.newVersion}`;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new package version');
    return null;
  }
}
