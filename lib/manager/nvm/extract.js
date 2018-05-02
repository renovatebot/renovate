module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  const deps = [
    {
      depName: 'node',
      currentVersion: content.trim(),
    },
  ];
  return { deps };
}
