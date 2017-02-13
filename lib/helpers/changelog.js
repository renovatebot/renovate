const logger = require('winston');
const changelog = require('changelog');

module.exports = getChangeLog;

// Get Changelog
async function getChangeLog(depName, fromVersion, newVersion) {
  logger.debug(`getChangeLog(${depName}, ${fromVersion}, ${newVersion})`);
  if (!fromVersion || fromVersion === newVersion) {
    return '';
  }
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  let markdownLog;
  try {
    const log = await changelog.generate(depName, semverString);
    // We should probably write our own markdown generation here:
    markdownLog = changelog.markdown(log);
  } catch (error) {
    logger.verbose(`getChangeLog error: ${error}`);
  }
  // Add a header if log exists
  if (!markdownLog) {
    logger.verbose(`No changelog for ${depName}`);
    markdownLog = '';
  } else {
    markdownLog = `### Changelog\n\n${markdownLog}`;
    // Fix up the markdown formatting of changelog
    // This is needed for GitLab in particular
    markdownLog = markdownLog.replace(/(.*?)\n[=]{10,}/g, '#### $1');
  }
  return markdownLog;
}
