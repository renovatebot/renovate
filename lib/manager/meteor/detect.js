module.exports = {
  detectPackageFiles,
};

async function detectPackageFiles(config, fileList) {
  const packageFiles = [];
  if (config.meteor.enabled) {
    for (const file of fileList) {
      if (file === 'package.js' || file.endsWith('/package.js')) {
        const content = await config.api.getFileContent(file);
        if (content && content.replace(/\s/g, '').includes('Npm.depends({')) {
          packageFiles.push(file);
        }
      }
    }
  }
  return packageFiles;
}
