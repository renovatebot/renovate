module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(`docker.updateDependency(): ${upgrade.newFrom}`);
    const oldLine = new RegExp(
      `(^|\\n)${upgrade.fromPrefix}(\\s+)${
        upgrade.dockerRegistry ? upgrade.dockerRegistry + '/' : ''
      }${upgrade.depName}[^\\s]*(\\s?)${upgrade.fromSuffix}\\n`
    );
    const newLine = `$1${upgrade.fromPrefix}$2${upgrade.newFrom}$3${
      upgrade.fromSuffix
    }\n`;
    const newFileContent = fileContent.replace(oldLine, newLine);
    return newFileContent;
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
