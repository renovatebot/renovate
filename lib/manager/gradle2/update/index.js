const groovy = require('./groovy');
const kotlin = require('./kotlin');

module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  if (upgrade.gradleFileType === 'groovy') {
    return groovy.updateDependency(currentFileContent, upgrade);
  }
  if (upgrade.gradleFileType === 'kotlin') {
    return kotlin.updateDependency(currentFileContent, upgrade);
  }
  logger.error('Unknown gradle2 gradleFileType: ' + upgrade.gradleFileType);
  return currentFileContent;
}
