const { logger } = require('../../logger');
const { getDep } = require('../dockerfile/extract');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  const deps = [];
  try {
    const lines = content.split('\n');
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
      const line = lines[lineNumber];
      const match = line.match(/^\s* image:\s*'?"?([^\s'"]+)'?"?\s*$/);
      if (match) {
        const currentFrom = match[1];
        const dep = getDep(currentFrom);
        logger.debug(
          {
            depName: dep.depName,
            currentValue: dep.currentValue,
            currentDigest: dep.currentDigest,
          },
          'DroneCI docker image'
        );
        dep.depType = 'docker';
        dep.managerData = { lineNumber };
        deps.push(dep);
      }
    }
  } catch (err) /* istanbul ignore next */ {
    logger.warn({ err }, 'Error extracting DroneCI images');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
