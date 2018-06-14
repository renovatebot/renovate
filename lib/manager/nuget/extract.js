module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  logger.debug('nuget.extractDependencies()');
  const deps = [];

  let lineNumber = 0;
  for (const line of content.split('\n')) {
    const match = line.match(
      /<PackageReference.*Include\s*=\s*"([^"]+)".*Version\s*=\s*"([^"]+)"/
    );
    if (match) {
      const depName = match[1];
      const currentVersion = match[2];

      deps.push({
        depType: 'nuget',
        depName,
        currentVersion,
        lineNumber,
      });
    }
    lineNumber += 1;
  }
  return { deps };
}
