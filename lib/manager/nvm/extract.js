module.exports = {
  extractDependencies,
};

function extractDependencies(fileName, content) {
  const deps = [
    {
      depName: 'node',
      currentVersion: content.trim(),
    },
  ];
  return { deps };
}
