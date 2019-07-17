const { logger } = require('../../logger');
const { getDep } = require('../dockerfile/extract');

module.exports = {
  extractPackageFile,
};

function extractPackageFile(content) {
  logger.debug('github-actions.extractPackageFile()');
  const deps = [];
  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(/^\s+uses = "docker:\/\/([^"]+)"\s*$/);
    if (match) {
      const currentFrom = match[1];
      /** @type any */
      const dep = getDep(currentFrom);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Docker image inside GitHub Actions'
      );
      dep.lineNumber = lineNumber;
      dep.versionScheme = 'docker';
      deps.push(dep);
    }
    lineNumber += 1;
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
