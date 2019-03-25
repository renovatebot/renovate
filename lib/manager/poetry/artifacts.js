module.exports = {
  getArtifacts,
};

async function getArtifacts(
  packageFileName,
  updatedDeps,
  newPackageFileContent,
  config
) {
  await logger.debug(`poetry.getArtifacts(${packageFileName})`);
  const lockFileName = 'poetry.lock';
  const newPoetryLockContent = '';
  return [
    {
      file: {
        name: lockFileName,
        contents: newPoetryLockContent,
      },
    },
  ];
}
