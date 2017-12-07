module.exports = {
  setNewValue,
};

function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`bazel.setNewValue: ${upgrade.newVersion}`);
    const newDef = upgrade.def.replace(
      /tag = "[^"]+"/,
      `tag = "${upgrade.newVersion}"`
    );
    logger.debug({ oldDef: upgrade.def, newDef });
    return currentFileContent.replace(upgrade.def, newDef);
  } catch (err) {
    logger.info({ err }, 'Error setting new bazel WORKSPACE version');
    return null;
  }
}
