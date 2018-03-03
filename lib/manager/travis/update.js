const detectIndent = require('detect-indent');

module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`node.setNewValue: ${upgrade.newVersions}`);
    const indent = detectIndent(currentFileContent).indent || '  ';
    let newString = `\nnode_js:\n`;
    upgrade.newVersions.forEach(version => {
      newString += `${indent}- '${version}'\n`;
    });
    return currentFileContent.replace(/\nnode_js:(\n\s+[^\n]+)+\n/, newString);
  } catch (err) {
    logger.info({ err }, 'Error setting new .travis.yml node versions');
    return null;
  }
}
