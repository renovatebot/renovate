module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(`bundler.updateDependency(): ${upgrade.newVersion}`);
    const newContent = fileContent;
    // TODO replace version in file
    return newContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new Gemfile value');
    return null;
  }
}
