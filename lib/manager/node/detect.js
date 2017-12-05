module.exports = {
  detectPackageFiles,
};

function detectPackageFiles(config, fileList) {
  logger.debug('node.detectPackageFiles()');
  if (config.node.enabled) {
    if (fileList.includes('.travis.yml')) {
      return ['.travis.yml'];
    }
  }
  return [];
}
