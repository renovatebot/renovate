const { pluginRegex } = require('../parse/kotlin');

module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  debugger;
  if (upgrade.depType === 'plugin') {
    const pluginContent = currentFileContent.match(pluginRegex);
    if (!pluginContent) {
      logger.info('Could not locate plugin block');
      return null;
    }
    const escapedDepName = upgrade.depName.replace(/\./g, '\\.');
    const versionIdRegex = new RegExp(
      `(id\\("${escapedDepName}"\\)\\s+version\\s+").*?"`
    );
    const versionIdMatch = pluginContent[2].match(versionIdRegex);
    if (!versionIdMatch) {
      logger.info('Could not locate depName');
      return null;
    }
    const newPluginContent = pluginContent[2].replace(
      versionIdRegex,
      `$1${upgrade.newValue}"`
    );
    return currentFileContent.replace(pluginContent[2], newPluginContent);
  }
  logger.warn('Unsupported gradle2 depType: ' + upgrade.depType);
  return currentFileContent;
}
