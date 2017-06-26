module.exports = {
  extractDependencies,
};

// Returns an array of current dependencies
function extractDependencies(packageJson, sections) {
  // loop through dependency types
  return sections.reduce((allDeps, depType) => {
    // loop through each dependency within a type
    const depNames = packageJson[depType]
      ? Object.keys(packageJson[depType])
      : [];
    return allDeps.concat(
      depNames.map(depName => ({
        depType,
        depName,
        currentVersion: packageJson[depType][depName].trim(),
      }))
    );
  }, []);
}
