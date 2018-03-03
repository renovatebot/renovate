module.exports = {
  detectPackageFiles,
};

async function detectPackageFiles(config, fileList) {
  logger.debug('docker.detectPackageFiles()');
  const packageFiles = [];
  if (
    config.docker.enabled ||
    (config.enabled && config.docker.enabled !== false)
  ) {
    for (const file of fileList) {
      if (file === 'Dockerfile' || file.endsWith('/Dockerfile')) {
        const content = await platform.getFile(file);
        if (content) {
          if (content.match(/(^|\n)FROM .+\n/)) {
            packageFiles.push(file);
          }
        } else {
          logger.warn({ file }, 'No Dockerfile content');
        }
      }
    }
  }
  return packageFiles;
}
