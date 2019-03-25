module.exports = {
  updateDependency,
};

function updateDependency(currentFileContent, upgrade) {
  logger.trace({ config: upgrade }, 'poetry.updateDependency()');
  const lines = currentFileContent.split('\n');
  return lines.join('\n');
}
