module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  const deps = [
    {
      depName: 'node',
      currentVersion: content.trim(),
      purl: 'pkg:github/nodejs/node?clean=true',
      versionScheme: 'semver',
    },
  ];
  return { deps };
}
