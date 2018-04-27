module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('buildkite.extractDependencies()');
  logger.trace({ content });
  const deps = [];
  // Detect all dependencies within this pipeline.yml
  /*
    depType - use if there's a need to differentiate different "types" within the same file
    depName - package name
    currentVersion - current version or range in the file
  */
  return deps;
}
