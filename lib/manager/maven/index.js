const { extractDependencies } = require('./extract');
const {
  isPrimitiveVersion,
  extendRange,
} = require('../../versioning/maven/compare');

async function extractAllPackageFiles(config, packageFiles) {
  const mavenFiles = [];
  for (const packageFile of packageFiles) {
    const content = await platform.getFile(packageFile);
    if (content) {
      const deps = extractDependencies(content);
      if (deps) {
        mavenFiles.push({
          packageFile,
          manager: 'maven',
          ...deps,
        });
      } else {
        logger.info({ packageFile }, 'can not read dependencies');
      }
    } else {
      logger.info({ packageFile }, 'packageFile has no content');
    }
  }
  return mavenFiles;
}

function updateDependency(fileContent, upgrade) {
  const { currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const versionClosePosition = rightPart.indexOf('</');
  const restPart = rightPart.slice(versionClosePosition);
  const versionPart = rightPart.slice(0, versionClosePosition);
  const version = versionPart.trim();
  if (version === newValue) {
    return fileContent;
  }
  if (version === currentValue) {
    const finalValue = isPrimitiveVersion(currentValue)
      ? newValue
      : extendRange(currentValue, newValue);
    if (currentValue === finalValue) return fileContent;
    const replacedPart = versionPart.replace(currentValue, finalValue);
    return leftPart + replacedPart + restPart;
  }
  return null;
}

module.exports = {
  extractAllPackageFiles,
  updateDependency,
};
