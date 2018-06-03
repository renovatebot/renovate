const detectIndent = require('detect-indent');

module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(`travis.updateDependency(): ${upgrade.newValue}`);
    const indent = detectIndent(fileContent).indent || '  ';
    const quote =
      fileContent.split(`'`).length > fileContent.split(`"`).length ? `'` : `"`;
    let newString = `node_js:\n`;
    upgrade.newValue.forEach(version => {
      newString += `${indent}- ${quote}${version}${quote}\n`;
    });
    return fileContent.replace(/node_js:(\n\s+[^\n]+)+\n/, newString);
  } catch (err) {
    logger.info({ err }, 'Error setting new .travis.yml node versions');
    return null;
  }
}
