const changelog = require('changelog');
const logger = require('winston');

module.exports = getChangeLog;

// Get Changelog
async function getChangeLog(depName, workingVersion, newVersion) {
  if (!workingVersion || workingVersion === newVersion) {
    return '';
  }
  const semverString = `>${workingVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  let markdownLog;
  try {
    const log = await changelog.generate(depName, semverString);
    markdownLog = changelog.markdown(log);
  } catch (error) {
    logger.verbose(`getChangelog error: ${error}`);
  }
  // Add a header if log exists
  if (!markdownLog) {
    logger.verbose(`No changelog for ${depName}`);
    markdownLog = '';
  } else {
    markdownLog = `### Changelog\n\n${markdownLog}`;
    markdownLog = markdownLog.replace(/(.*?)\n[=]{10,}/g, '#### $1');
  }
  return markdownLog;
}
