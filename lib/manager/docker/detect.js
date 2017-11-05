module.exports = {
  detectPackageFiles,
};

async function detectPackageFiles(config, fileList) {
  const { logger } = config;
  logger.debug('docker.detectPackageFiles()');
  const packageFiles = [];
  if (config.docker.enabled) {
    for (const file of fileList) {
      if (file === 'Dockerfile' || file.endsWith('/Dockerfile')) {
        const content = await config.api.getFileContent(file);
        const strippedComment = content.replace(/^(#.*?\n)+/, '');
        // This means we skip ones with ARG for now
        const fromMatch = strippedComment.startsWith('FROM ');
        if (fromMatch) {
          packageFiles.push(file);
        }
      }
    }
  }
  return packageFiles;
}
