module.exports = {
  extractDependencies,
};

function extractDependencies(packageJson, depType) {
  const depNames = packageJson[depType]
    ? Object.keys(packageJson[depType])
    : [];
  return depNames.map(depName => ({
    depType,
    depName,
    currentVersion: packageJson[depType][depName].trim(),
  }));
}
