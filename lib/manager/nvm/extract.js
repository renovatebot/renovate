module.exports = {
  extractDependencies,
};

function extractDependencies(packageContent) {
  return [
    {
      depName: 'node',
      depType: '.nvmrc',
      currentVersion: packageContent.trim(),
    },
  ];
}
