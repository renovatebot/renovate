const minimatch = require('minimatch');
const { logger } = require('../../../logger');

module.exports = {
  getIncludedFiles,
  filterIgnoredFiles,
  getMatchingFiles,
};

function getIncludedFiles(fileList, includePaths) {
  if (!(includePaths && includePaths.length)) {
    return fileList;
  }
  return fileList.filter(file =>
    includePaths.some(
      includePath =>
        file === includePath || minimatch(file, includePath, { dot: true })
    )
  );
}

function filterIgnoredFiles(fileList, ignorePaths) {
  if (!(ignorePaths && ignorePaths.length)) {
    return fileList;
  }
  return fileList.filter(
    file =>
      !ignorePaths.some(
        ignorePath =>
          file.includes(ignorePath) ||
          minimatch(file, ignorePath, { dot: true })
      )
  );
}

function getMatchingFiles(fileList, manager, fileMatch) {
  let matchedFiles = [];
  for (const match of fileMatch) {
    logger.debug(`Using file match: ${match} for manager ${manager}`);
    matchedFiles = matchedFiles.concat(
      fileList.filter(file => file.match(new RegExp(match)))
    );
  }
  // filter out duplicates
  return [...new Set(matchedFiles)];
}
