const crypto = require('crypto');
const got = require('../../util/got');

module.exports = {
  updateDependency,
};

async function updateDependency(fileContent, upgrade) {
  try {
    logger.debug(
      `bazel.updateDependency(): ${upgrade.newValue || upgrade.newDigest}`
    );
    let newDef;
    if (upgrade.depType === 'container_pull') {
      newDef = upgrade.def
        .replace(/(tag\s*=\s*)"[^"]+"/, `$1"${upgrade.newValue}"`)
        .replace(/(digest\s*=\s*)"[^"]+"/, `$1"${upgrade.newDigest}"`);
    }
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
        newUrl = `https://github.com/${upgrade.repo}/releases/download/${upgrade.newValue}/${shortRepo}-${upgrade.newValue}.tar.gz`;
        file = (await got(newUrl, {
          encoding: null,
        })).body;
      } catch (err) {
        logger.debug(
          'Failed to download release download - trying archive instead'
        );
        newUrl = `https://github.com/${upgrade.repo}/archive/${upgrade.newValue}.tar.gz`;
        file = (await got(newUrl, { encoding: null })).body;
      }
      const hash = crypto
        .createHash('sha256')
        .update(Buffer.from(file))
        .digest('hex');
      const valuePattern = new RegExp(
        upgrade.currentValue.replace(/\./g, '\\.').replace(/^v/, ''),
        'g'
      );
      newDef = upgrade.def.replace(
        valuePattern,
        upgrade.newValue.replace(/^v/, '')
      );
      newDef = newDef.replace(/(sha256\s*=\s*)"[^"]+"/, `$1"${hash}"`);
    } else if (upgrade.depType === 'http_archive' && upgrade.newDigest) {
      const [, shortRepo] = upgrade.repo.split('/');
      const newUrl = `https://github.com/${upgrade.repo}/archive/${upgrade.newDigest}.tar.gz`;
      const file = (await got(newUrl, { encoding: null })).body;
      const hash = crypto
        .createHash('sha256')
        .update(Buffer.from(file))
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
    let existingRegExStr = `${upgrade.depType}\\([^\\)]+name\\s*=\\s*"${upgrade.depName}"(.*\\n)+?\\s*\\)`;
    if (newDef.endsWith('\n')) {
      existingRegExStr += '\n';
    }
    const existingDef = new RegExp(existingRegExStr);
    // istanbul ignore if
    if (!fileContent.match(existingDef)) {
      logger.info('Cannot match existing string');
      return null;
    }
    return fileContent.replace(existingDef, newDef);
  } catch (err) /* istanbul ignore next */ {
    logger.info({ err }, 'Error setting new bazel WORKSPACE version');
    return null;
  }
}
