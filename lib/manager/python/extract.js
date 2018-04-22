
module.exports = {
  extractDependencies,
};

function extractDependencies(packageContent) {
  const regex = /^([a-z][-\w.]+)==([\d.]+)/ig;
  return packageContent.split('\n')
    .map(l => regex.exec(l))
    .filter(Boolean)
    .map((matches) => ({
      depName: matches[1],
      depType: 'python',
      currentVersion: matches[2]
    }));
}
