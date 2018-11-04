module.exports = {
  getManagerPackageFiles,
};

const {
  extractAllFiles,
  extractPackageFile,
  get,
} = require('../../../manager');

const {
  getIncludedFiles,
  filterIgnoredFiles,
  getMatchingFiles,
} = require('./file-match');

async function getManagerPackageFiles(config, managerConfig) {
  const { manager, enabled, includePaths, ignorePaths } = managerConfig;
  logger.trace(`getPackageFiles(${manager})`);
  if (!enabled) {
    logger.debug(`${manager} is disabled`);
    return [];
  }
  if (
    config.enabledManagers.length &&
    !config.enabledManagers.includes(manager)
  ) {
    logger.debug(`${manager} is not in enabledManagers list`);
    return [];
  }
  let fileList = await platform.getFileList();
  fileList = getIncludedFiles(fileList, includePaths);
  fileList = filterIgnoredFiles(fileList, ignorePaths);
  const matchedFiles = getMatchingFiles(
    fileList,
    manager,
    config[manager].fileMatch
  );
  if (matchedFiles.length) {
    logger.debug(
      `Matched ${
        matchedFiles.length
      } file(s) for manager ${manager}: ${matchedFiles.join(', ')}`
    );
  }
  if (get(manager, 'extractAllFiles')) {
    return extractAllFiles(manager, config, matchedFiles);
  }
  const packageFiles = [];
  const matchedFilesContent = await extractMatchedFilesContent(matchedFiles);
  for (const packageFile of matchedFiles) {
    const content = matchedFilesContent[packageFile];
    if (content) {
      const res = await extractPackageFile(
        manager,
        content,
        packageFile,
        config
      );
      if (res) {
        packageFiles.push({
          packageFile,
          manager,
          ...res,
        });
      }
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }
  return packageFiles;
}

async function extractMatchedFilesContent(matchedFiles) {
  const matchedFilesContent = {};
  for (const packageFile of matchedFiles) {
    matchedFilesContent[packageFile] = await platform.getFile(packageFile);
  }
  return matchedFilesContent;
}
