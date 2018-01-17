const configParser = require('../../config');

module.exports = {
  resolvePackageFile,
};

async function resolvePackageFile(config, inputFile) {
  const packageFile = configParser.mergeChildConfig(config.docker, inputFile);
  logger.debug(
    `Resolving packageFile ${JSON.stringify(packageFile.packageFile)}`
  );
  packageFile.content = await platform.getFile(packageFile.packageFile);
  if (!packageFile.content) {
    logger.debug('No packageFile content');
    return null;
  }
  const strippedComment = packageFile.content.replace(/^((#.*?|\s*)\n)+/, '');
  const fromMatch = strippedComment.match(/^[Ff][Rr][Oo][Mm] (.*)\n/);
  if (!fromMatch) {
    logger.debug(
      { content: packageFile.content, strippedComment },
      'No FROM found'
    );
    return null;
  }
  [, packageFile.currentFrom] = fromMatch;
  logger.debug('Adding Dockerfile');
  return packageFile;
}
