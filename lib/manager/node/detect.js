module.exports = {
  detectPackageFiles,
};

function detectPackageFiles(config, fileList) {
  logger.debug('node.detectPackageFiles()');
  if (
    config.node.enabled ||
    (config.enabled && config.node.enabled !== false)
  ) {
    if (fileList.includes('.travis.yml')) {
      return ['.travis.yml'];
    }
  }
  return [];
}
