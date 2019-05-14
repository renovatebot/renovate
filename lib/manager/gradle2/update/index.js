const groovy = require('./groovy');

module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  if (upgrade.gradleFileType === 'groovy') {
    return groovy.updateDependency(currentFileContent, upgrade);
  }
  logger.error('Unknown gradle2 gradleFileType: ' + upgrade.gradleFileType);
  return currentFileContent;
}
