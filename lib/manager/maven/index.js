const { extractDependencies } = require('./extract');

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
  const leftHalf = fileContent.slice(0, fileReplacePosition);
  const rightHalf = fileContent
    .slice(fileReplacePosition)
    .replace(currentValue, newValue);
  return leftHalf + rightHalf;
}

module.exports = {
  extractAllPackageFiles,
  updateDependency,
};
