
module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  const lines = fileContent.split('\n');
  lines[upgrade.lineNumber] = `${upgrade.depName}==${upgrade.newVersion}`;
  return lines.join('\n');
}
