module.exports = {
  extractDependencies,
};

function extractDependencies(packageContent) {
  const deps = [];
  try {
    const definitions = packageContent.match(
      /git_repository\(([\s\S]*?)\n\)\n?/g
    );
    logger.debug({ definitions }, `Found ${definitions.length} definitions`);
    definitions.forEach(def => {
      logger.debug({ def }, 'Checking bazel definition');
      const dep = { def };
      const [, depName] = def.match(/name = "([^"]+)"/);
      const [, remote] = def.match(/remote = "([^"]+)"/);
      const [, currentVersion] = def.match(/tag = "([^"]+)"/);
      logger.debug({ depName, remote, currentVersion });
      if (depName && remote && currentVersion) {
        dep.depName = depName;
        dep.remote = remote;
        dep.currentVersion = currentVersion;
        deps.push(dep);
      } else {
        // istanbul ignore next
        logger.warn('Failed to find dependency in bazel WORKSPACE definition');
      }
    });
  } catch (err) {
    logger.info({ packageContent }, 'Failed to parse bazel WORKSPACE');
  }
  return deps;
}
