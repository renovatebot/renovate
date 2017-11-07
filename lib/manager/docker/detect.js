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
        const content = await platform.getFileContent(file);
        if (content) {
          const strippedComment = content.replace(/^(#.*?\n)+/, '');
          // This means we skip ones with ARG for now
          const fromMatch = strippedComment.startsWith('FROM ');
          if (fromMatch) {
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
