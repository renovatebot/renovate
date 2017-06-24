module.exports = detectPackageFiles;

async function detectPackageFiles(config) {
  // autodiscover filenames if none manually configured
  const fileNames = await config.api.findFilePaths('package.json');
  // Map to config structure
  const packageFiles = fileNames.map(fileName => ({ fileName }));
  return Object.assign({}, config, { packageFiles });
}
