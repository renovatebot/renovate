module.exports = {
  extractDependencies,
};

function extractDependencies(content) {
  let deps = [];
  const npmDepends = content.match(/Npm\.depends\({([\s\S]*?)}\);/);
  if (!npmDepends) {
    return null;
  }
  try {
    deps = npmDepends[1]
      .replace(/(\s|\\n|\\t|'|")/g, '')
      .split(',')
      .map(dep => dep.trim())
      .filter(dep => dep.length)
      .map(dep => dep.split(/:(.*)/))
      .map(arr => {
        const [depName, currentVersion] = arr;
        // istanbul ignore if
        if (!(depName && currentVersion)) {
          logger.warn({ content }, 'Incomplete npm.depends match');
        }
        return {
          depName,
          currentVersion,
        };
      })
      .filter(dep => dep.depName && dep.currentVersion);
  } catch (err) {
    logger.warn({ content }, 'Failed to parse meteor package.js');
  }
  if (!deps.length) {
    return null;
  }
  return { deps };
}
