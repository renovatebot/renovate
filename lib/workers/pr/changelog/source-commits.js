
const changelog = require('changelog');

module.exports = {
  getChangeLogJSON,
};

async function getChangeLogJSON(depName, fromVersion, newVersion) {
  try {
    const semverString = `>${fromVersion} <=${newVersion}`;
    logger.trace(`semverString: ${semverString}`);
    const res = await changelog.generate(depName, semverString);
    if (!res) {
      logger.info({ depName, fromVersion, newVersion }, 'No changelog found');
      return null;
    }
    // Sort from oldest to newest
    if (Array.isArray(res.versions)) {
      res.versions.reverse();
      res.versions.forEach(version => {
        if (Array.isArray(version.changes)) {
          version.changes.reverse();
        }
      });
    }
    return res;
  } catch (err) {
    logger.debug({ err }, `getChangeLogJSON error`);
    return null;
  }
}
