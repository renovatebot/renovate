module.exports = {
  getManagerPackageFiles,
};

const {
  extractDependencies,
  postExtract,
  preExtract,
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
  const packageFiles = [];
  const matchedFilesContent = await extractMatchedFilesContent(matchedFiles);
  await preExtract(manager, config, matchedFilesContent);

  for (const packageFile of matchedFiles) {
    const content = matchedFilesContent[packageFile];
    if (content) {
      const res = await extractDependencies(
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
  await postExtract(manager, packageFiles);
  return packageFiles;
}

async function extractMatchedFilesContent(matchedFiles) {
  const matchedFilesContent = {};
  for (const packageFile of matchedFiles) {
    matchedFilesContent[packageFile] = await platform.getFile(packageFile);
  }
  return matchedFilesContent;
}
