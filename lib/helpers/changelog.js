const changelog = require('changelog');

module.exports = {
  getChangeLogJSON,
  getMarkdown,
  getChangeLog,
};

async function getChangeLogJSON(depName, fromVersion, newVersion, logger) {
  logger.debug(`getChangeLogJSON(${depName}, ${fromVersion}, ${newVersion})`);
  if (!fromVersion || fromVersion === newVersion) {
    return null;
  }
  const semverString = `>${fromVersion} <=${newVersion}`;
  logger.debug(`semverString: ${semverString}`);
  try {
    return await changelog.generate(depName, semverString);
  } catch (err) {
    logger.warn(`getChangeLogJSON error: ${JSON.stringify(err)}`);
    return null;
  }
}

function getMarkdown(changelogJSON) {
  if (!changelogJSON) {
    return 'No changelog available';
  }
  let markdownLog = changelog.markdown(changelogJSON);
  markdownLog = `### Changelog\n\n${markdownLog}`;
  // Fix up the markdown formatting of changelog
  // This is needed for GitLab in particular
  markdownLog = markdownLog.replace(/(.*?)\n[=]{10,}/g, '#### $1');
  return markdownLog;
}

// Get Changelog
async function getChangeLog(depName, fromVersion, newVersion, logger) {
  const logJSON = await getChangeLogJSON(
    depName,
    fromVersion,
    newVersion,
    logger
  );
  return getMarkdown(logJSON);
}
