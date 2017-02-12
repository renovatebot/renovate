const changelog = require('changelog');
const logger = require('winston');

module.exports = getChangeLog;

// Get Changelog
async function getChangeLog(upgrade) {
  if (!upgrade.workingVersion || upgrade.workingVersion === upgrade.newVersion) {
    return Object.assign(upgrade, { changelog: '' });
  }
  const semverString = `>${upgrade.workingVersion} <=${upgrade.newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  let markdownLog;
  try {
    const log = await changelog.generate(upgrade.depName, semverString);
    markdownLog = changelog.markdown(log);
  } catch (error) {
    logger.verbose(`getChangelog error: ${error}`);
  }
  // Add a header if log exists
  if (!markdownLog) {
    logger.verbose(`No changelog for ${upgrade.depName}`);
    markdownLog = '';
  } else {
    markdownLog = `### Changelog\n\n${markdownLog}`;
    markdownLog = markdownLog.replace(/(.*?)\n[=]{10,}/g, '#### $1');
  }
  return Object.assign(upgrade, { changelog: markdownLog });
}
