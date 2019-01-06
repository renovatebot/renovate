module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(upgrade, 'gradle-wrapper.updateDependency()');
    const lines = fileContent.split('\n');

    const url = upgrade.downloadUrl.replace(':', '\\:');
    lines[upgrade.lineNumber] = `distributionUrl=${url}`;

    if (upgrade.digests === 'true' && upgrade.shaLineNumber) {
      lines[upgrade.shaLineNumber] = `distributionSha256Sum=${
        upgrade.checksum
      }`;
    } else if (upgrade.digests === 'true') {
      lines.splice(
        upgrade.lineNumber + 1,
        0,
        `distributionSha256Sum=${upgrade.checksum}`
      );
    } else if (upgrade.digests !== 'true' && upgrade.shaLineNumber) {
      lines.splice(upgrade.shaLineNumber, 1);
    }

    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Gradle Wrapper release value');
    return null;
  }
}
