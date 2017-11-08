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
      .map(dep => dep.split(/:(.*)/))
      .map(arr => ({
        depType: 'npmDepends',
        depName: arr[0],
        currentVersion: arr[1],
      }));
  } catch (err) {
    logger.warn({ packageContent }, 'Failed to parse meteor package.js');
  }
  return deps;
}
