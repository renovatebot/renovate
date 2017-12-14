module.exports = {
  extractDependencies,
};

function extractDependencies(packageContent) {
  const definitions = packageContent.match(
    /(git_repository|http_archive)\(([\s\S]*?)\n\)\n?/g
  );
  if (!definitions) {
    logger.debug('No matching WORKSPACE definitions found');
    return [];
  }
  logger.debug({ definitions }, `Found ${definitions.length} definitions`);
  const deps = [];
  definitions.forEach(def => {
    logger.debug({ def }, 'Checking bazel definition');
    const dep = { def };
    let depName;
    let remote;
    let currentVersion;
    let url;
    let sha256;
    let match = def.match(/name = "([^"]+)"/);
    if (match) {
      [, depName] = match;
    }
    match = def.match(/remote = "([^"]+)"/);
    if (match) {
      [, remote] = match;
    }
    match = def.match(/tag = "([^"]+)"/);
    if (match) {
      [, currentVersion] = match;
    }
    match = def.match(/url = "([^"]+)"/);
    if (match) {
      [, url] = match;
    }
    match = def.match(/sha256 = "([^"]+)"/);
    if (match) {
      [, sha256] = match;
    }
    logger.debug({ depName, remote, currentVersion });
    const urlPattern = /^https:\/\/github.com\/([^\\/]+\/[^\\/]+)\/releases\/download\/([^\\/]+)\/.*?\.tar\.gz$/;
    if (
      def.startsWith('git_repository') &&
      depName &&
      remote &&
      currentVersion
    ) {
      dep.depType = 'git_repository';
      dep.depName = depName;
      dep.remote = remote;
      dep.currentVersion = currentVersion;
      deps.push(dep);
    } else if (
      def.startsWith('http_archive') &&
      depName &&
      url &&
      sha256 &&
      url.match(urlPattern)
    ) {
      match = url.match(urlPattern);
      dep.depType = 'http_archive';
      dep.depName = depName;
      [, dep.repo, dep.currentVersion] = match;
      deps.push(dep);
    } else {
      logger.info(
        { def },
        'Failed to find dependency in bazel WORKSPACE definition'
      );
    }
  });
  return deps;
}
