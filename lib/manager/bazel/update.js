const hasha = require('hasha');
const got = require('../../util/got');

module.exports = {
  updateDependency,
};

async function getHash(url) {
  const hash = await hasha.fromStream(got.stream(url), {
    algorithm: 'sha256',
  });
  return hash;
}

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
      const valuePattern = new RegExp(
        upgrade.currentValue.replace(/\./g, '\\.').replace(/^v/, ''),
        'g'
      );
      newDef = upgrade.def.replace(
        valuePattern,
        upgrade.newValue.replace(/^v/, '')
      );
      let urlsLine = newDef.split('\n');
      urlsLine = urlsLine.map(line => line.trim());
      urlsLine = urlsLine.find(line => line.startsWith('urls'));
      let url;
      if (urlsLine) {
        url = urlsLine.substring(urlsLine.indexOf('"') + 1);
        url = url.substring(0, url.indexOf('"'));
        if (url.includes(',')) {
          url = url.substring(0, url.indexOf(','));
        }
      }
      let hash;
      if (url && url.length) {
        logger.debug({ url }, 'Trying discovered URL');
        hash = await hasha.fromStream(got.stream(url), {
          algorithm: 'sha256',
        });
      } else {
        let newUrl;
        try {
          const [, shortRepo] = upgrade.repo.split('/');
          newUrl = `https://github.com/${upgrade.repo}/releases/download/${upgrade.newValue}/${shortRepo}-${upgrade.newValue}.tar.gz`;
          logger.debug({ newUrl }, 'Trying download URL');
          hash = await hasha.fromStream(got.stream(newUrl), {
            algorithm: 'sha256',
          });
        } catch (err) {
          newUrl = `https://github.com/${upgrade.repo}/archive/${upgrade.newValue}.tar.gz`;
          logger.debug({ newUrl }, 'Trying archive URL instead');
          hash = await hasha.fromStream(got.stream(newUrl), {
            algorithm: 'sha256',
          });
        }
      }
      logger.debug({ hash }, 'Calculated hash');
      newDef = newDef.replace(/(sha256\s*=\s*)"[^"]+"/, `$1"${hash}"`);
    } else if (upgrade.depType === 'http_archive' && upgrade.newDigest) {
      const [, shortRepo] = upgrade.repo.split('/');
      const url = `https://github.com/${upgrade.repo}/archive/${upgrade.newDigest}.tar.gz`;
      const hash = await getHash(url);
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
