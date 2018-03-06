const detectIndent = require('detect-indent');

module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`node.setNewValue: ${upgrade.newVersion}`);
    const indent = detectIndent(currentFileContent).indent || '  ';
    const quote =
      currentFileContent.split(`'`).length >
      currentFileContent.split(`"`).length
        ? `'`
        : `"`;
    let newString = `\nnode_js:\n`;
    upgrade.newVersion.forEach(version => {
      newString += `${indent}- ${quote}${version}${quote}\n`;
    });
    return currentFileContent.replace(/\nnode_js:(\n\s+[^\n]+)+\n/, newString);
  } catch (err) {
    logger.info({ err }, 'Error setting new .travis.yml node versions');
    return null;
  }
}
