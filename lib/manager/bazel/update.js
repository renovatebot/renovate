const crypto = require('crypto');
const got = require('got');

module.exports = {
  updateDependency,
};

async function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(`bazel.updateDependency(): ${upgrade.newValue}`);
    let newDef;
    if (
      upgrade.depType === 'git_repository' ||
      upgrade.depType === 'go_repository'
    ) {
      newDef = upgrade.def
        .replace(/(tag\s*=\s*)"[^"]+"/, `$1"${upgrade.newValue}"`)
        .replace(/(commit\s*=\s*)"[^"]+"/, `$1"${upgrade.newDigest}"`);
      if (upgrade.currentDigest && upgrade.updateType !== 'digest') {
        newDef = newDef.replace(
          /(commit\s*=\s*)"[^"]+".*?\n/,
          `$1"${upgrade.newDigest}",  # ${upgrade.newValue}\n`
        );
      }
    } else if (upgrade.depType === 'http_archive' && upgrade.newValue) {
      const [, shortRepo] = upgrade.repo.split('/');
      let newUrl;
      let file;
      try {
        newUrl = `https://github.com/${upgrade.repo}/releases/download/${
          upgrade.newValue
        }/${shortRepo}-${upgrade.newValue}.tar.gz`;
        file = (await got(newUrl, { encoding: null })).body;
      } catch (err) {
        logger.debug(
          'Failed to download release download - trying archive instead'
        );
        newUrl = `https://github.com/${upgrade.repo}/archive/${
          upgrade.newValue
        }.tar.gz`;
        file = (await got(newUrl, { encoding: null })).body;
      }
      const hash = crypto
        .createHash('sha256')
        .update(file)
        .digest('hex');
      const valuePattern = new RegExp(
        upgrade.currentValue.replace(/\./g, '\\.'),
        'g'
      );
      newDef = upgrade.def.replace(valuePattern, upgrade.newValue);
      newDef = newDef.replace(/(sha256\s*=\s*)"[^"]+"/, `$1"${hash}"`);
    } else if (upgrade.depType === 'http_archive' && upgrade.newDigest) {
      const [, shortRepo] = upgrade.repo.split('/');
      const newUrl = `https://github.com/${upgrade.repo}/archive/${
        upgrade.newDigest
      }.tar.gz`;
      const file = (await got(newUrl, { encoding: null })).body;
      const hash = crypto
        .createHash('sha256')
        .update(file)
        .digest('hex');

      newDef = upgrade.def.replace(/(sha256\s*=\s*)"[^"]+"/, `$1"${hash}"`);
      newDef = newDef.replace(
        new RegExp(`(strip_prefix\\s*=\\s*)"[^"]*"`),
        `$1"${shortRepo}-${upgrade.newDigest}"`
      );
      const match = upgrade.def.match(/(?<=archive\/).*(?=\.tar\.gz)/g) || [];
      match.forEach(matchedHash => {
        newDef = newDef.replace(matchedHash, upgrade.newDigest);
      });
    }
    logger.debug({ oldDef: upgrade.def, newDef });
    const existingDef = new RegExp(
      `${upgrade.depType}\\([^\\)]+name\\s*=\\s*"${
        upgrade.depName
      }"[^\\)]+\\)\n`
    );
    return fileContent.replace(existingDef, newDef);
  } catch (err) {
    logger.info({ err }, 'Error setting new bazel WORKSPACE version');
    return null;
  }
}
