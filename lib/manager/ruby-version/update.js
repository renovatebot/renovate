const { logger } = require('../../logger');

module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  logger.debug(`ruby-version.updateDependency(): ${upgrade.newValue}`);
  return `${upgrade.newValue}\n`;
}
