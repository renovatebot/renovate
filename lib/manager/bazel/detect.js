module.exports = {
  detectPackageFiles,
};

async function detectPackageFiles(config, fileList) {
  logger.debug('bazel.detectPackageFiles()');
  const packageFiles = [];
  if (config.bazel.enabled) {
    for (const file of fileList) {
      if (file === 'WORKSPACE' || file.endsWith('/WORKSPACE')) {
        const content = await platform.getFile(file);
        if (content && content.match(/(^|\n)git_repository\(/)) {
          packageFiles.push(file);
        }
      }
    }
  }
  return packageFiles;
}
