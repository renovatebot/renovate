module.exports = {
  extractDependencies,
};

function extractDependencies(packageContent) {
  let deps = [];
  try {
    deps = packageContent
      .match(/Npm\.depends\({([\s\S]*?)}\);/)[1]
      .replace(/(\s|\\n|\\t|'|")/g, '')
      .split(',')
      .map(dep => dep.trim())
      .filter(dep => dep.length)
      .map(dep => dep.split(/:(.*)/))
      .map(arr => {
        const [depName, currentVersion] = arr;
        // istanbul ignore if
        if (!(depName && currentVersion)) {
          logger.warn({ packageContent }, 'Incomplete npm.depends match');
        }
        return {
          depType: 'npmDepends',
          depName,
          currentVersion,
        };
      })
      .filter(dep => dep.depName && dep.currentVersion);
  } catch (err) {
    logger.warn({ packageContent }, 'Failed to parse meteor package.js');
  }
  return deps;
}
