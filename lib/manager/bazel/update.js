const crypto = require('crypto');
const got = require('got');

module.exports = {
  setNewValue,
};

async function setNewValue(currentFileContent, upgrade) {
  try {
    logger.debug(`bazel.setNewValue: ${upgrade.newVersion}`);
    let newDef;
    if (upgrade.depType === 'git_repository') {
      newDef = upgrade.def.replace(
        /tag = "[^"]+"/,
        `tag = "${upgrade.newVersion}"`
      );
    } else if (upgrade.depType === 'http_archive') {
      const [, shortRepo] = upgrade.repo.split('/');
      const newUrl = `https://github.com/${upgrade.repo}/releases/download/${
        upgrade.newVersion
      }/${shortRepo}-${upgrade.newVersion}.tar.gz`;
      const file = (await got(newUrl, { encoding: null })).body;
      const hash = crypto
        .createHash('sha256')
        .update(file)
        .digest('hex');
      newDef = upgrade.def.replace(/url = "[^"]+"/, `url = "${newUrl}"`);
      newDef = newDef.replace(/sha256 = "[^"]+"/, `sha256 = "${hash}"`);
    }
    logger.debug({ oldDef: upgrade.def, newDef });
    const existingDef = new RegExp(
      `${upgrade.depType}\\([^\\)]+name = "${upgrade.depName}"[^\\)]+\\)\n`
    );
    return currentFileContent.replace(existingDef, newDef);
  } catch (err) {
    logger.info({ err }, 'Error setting new bazel WORKSPACE version');
    return null;
  }
}
