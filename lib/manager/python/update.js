
module.exports = {
  updateDependency,
};

function updateDependency(fileContent, upgrade) {
  return fileContent.replace(
    `${upgrade.depName}==${upgrade.currentVersion}`,
    `${upgrade.depName}==${upgrade.newVersion}`
  );
}
