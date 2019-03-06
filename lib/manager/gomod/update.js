const { DateTime } = require('luxon');

module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  try {
    logger.debug(`gomod.updateDependency: ${upgrade.newValue}`);
    const { depName } = upgrade;
    let depNameNoVersion = depName
      .split('/')
      .slice(0, 3)
      .join('/');
    if (depNameNoVersion.startsWith('gopkg.in')) {
      depNameNoVersion = depNameNoVersion.replace(/\.v\d+$/, '');
    }
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    if (
      !lineToChange.includes(depNameNoVersion) &&
      !lineToChange.includes('rethinkdb/rethinkdb-go.v5')
    ) {
      logger.debug(
        { lineToChange, depName },
        "go.mod current line doesn't contain dependency"
      );
      return null;
    }
    let requireLine;
    if (upgrade.multiLine) {
      requireLine = new RegExp(/^(\s+[^\s]+)(\s+)([^\s]+)/);
    } else {
      requireLine = new RegExp(/^(require\s+[^\s]+)(\s+)([^\s]+)/);
    }
    if (!lineToChange.match(requireLine)) {
      logger.debug('No image line found');
      return null;
    }
    let newLine;
    if (upgrade.updateType === 'digest') {
      const newDigestRightSized = upgrade.newDigest.substring(
        0,
        upgrade.currentDigest.length
      );
      if (lineToChange.includes(newDigestRightSized)) {
        return currentFileContent;
      }
      logger.debug(
        { depName, lineToChange, newDigestRightSized },
        'gomod: need to update digest'
      );
      const currentDateTime = DateTime.local().toFormat('yyyyMMddHHmmss');
      const newValue = `v0.0.0-${currentDateTime}-${newDigestRightSized}`;
      newLine = lineToChange.replace(requireLine, `$1$2${newValue}`);
    } else {
      newLine = lineToChange.replace(requireLine, `$1$2${upgrade.newValue}`);
    }
    if (upgrade.updateType === 'major') {
      logger.debug({ depName }, 'gomod: major update');
      if (depName.startsWith('gopkg.in/')) {
        const oldV = depName.split('.').pop();
        newLine = newLine.replace(`.${oldV}`, `.v${upgrade.newMajor}`);
        // Package renames - I couldn't think of a better place to do this
        newLine = newLine.replace(
          'gorethink/gorethink.v5',
          'rethinkdb/rethinkdb-go.v5'
        );
      } else if (
        upgrade.newMajor > 1 &&
        !newLine.includes(`/v${upgrade.newMajor}`)
      ) {
        if (upgrade.currentValue.match(/^v(0|1)\./)) {
          // Add version
          newLine = newLine.replace(requireLine, `$1/v${upgrade.newMajor}$2$3`);
        } else {
          // Replace version
          const [oldV] = upgrade.currentValue.split('.');
          newLine = newLine.replace(
            new RegExp(`/${oldV}(\\s+)`),
            `/v${upgrade.newMajor}$1`
          );
        }
      }
    }
    if (lineToChange.endsWith('+incompatible')) {
      newLine += '+incompatible';
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new go.mod version');
    return null;
  }
}
