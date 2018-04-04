module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('ruby.extractDependencies()');
  logger.trace({ content });
  const deps = [];
  // Detect all dependencies within this Gemfile
  /*
    depType - use if there's a need to differentiate different "types" within the same file
    depName - package name
    currentVersion - current version or range in the file
    lockedVersion - exact version in the lock file. this can be skipped for now
  */
  return deps;
}
