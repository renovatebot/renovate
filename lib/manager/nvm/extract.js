module.exports = {
  extractDependencies,
};

function extractDependencies(fileName, content) {
  const deps = [
    {
      depName: 'node',
      depType: '.nvmrc',
      currentVersion: content.trim(),
    },
  ];
  return { deps };
}
