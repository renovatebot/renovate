module.exports = {
  detectPackageFiles,
};

function detectPackageFiles(config, fileList) {
  logger.debug('nvm.detectPackageFiles()');
  if (config.nvm.enabled) {
    if (fileList.includes('.nvmrc')) {
      return ['.nvmrc'];
    }
  }
  return [];
}
