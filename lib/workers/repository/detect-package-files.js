module.exports = detectPackageFiles;

async function detectPackageFiles(config) {
  config.logger.trace({ config }, 'detectPackageFiles');
  // autodiscover filenames if none manually configured
  const packageFiles = await config.api.findFilePaths('package.json');
  config.logger.debug(`Found ${packageFiles.length} package file(s)`);
  return Object.assign({}, config, { packageFiles });
}
