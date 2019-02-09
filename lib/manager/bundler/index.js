const { getArtifacts } = require('./artifacts');
const { getRangeStrategy } = require('./range');
const { updateDependency } = require('./update');
const { extractGemfile, extractLockfile } = require('./extract');

const language = 'ruby';
const manager = 'bundler';

const getLockfileName = basename => `${basename}.lock`;

const extractAllPackageFiles = async (_config, packageFiles) => {
  const results = await Promise.all(
    packageFiles.map(async packageFile => {
      const gemfileData = await extractGemfile(packageFile);
      const lockfileData = await extractLockfile(getLockfileName(packageFile));

      return { manager, packageFile, ...gemfileData, ...lockfileData };
    })
  );

  return results.filter(
    ({ deps, registryUrls }) => deps.length && registryUrls.length
  );
};

module.exports = {
  language,
  getArtifacts,
  getRangeStrategy,
  updateDependency,
  extractAllPackageFiles,
};
