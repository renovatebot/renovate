const hasha = require('hasha');
const got = require('../../util/got');

module.exports = {
  updateDependency,
};

function updateWithNewVersion(content, currentValue, newValue) {
  const currentVersion = currentValue.replace(/^v/, '');
  const newVersion = newValue.replace(/^v/, '');
  let newContent = content;
  do {
    newContent = newContent.replace(currentVersion, newVersion);
  } while (newContent.includes(currentVersion));
  return newContent;
}

function extractUrls(content) {
  const flattened = content.replace(/\n/g, '').replace(/\s/g, '');
  const urlsMatch = flattened.match(/urls=\[.*?\]/);
  if (!urlsMatch) {
    logger.debug({ content }, 'Cannot locate urls in new definition');
    return null;
  }
  const urls = urlsMatch[0]
    .replace('urls=[', '')
    .replace(/,?\]$/, '')
    .split(',')
    .map(url => url.replace(/"/g, ''));
  return urls;
}

async function getHashFromUrl(url) {
  const cacheNamespace = 'url-sha256';
  const cachedResult = await renovateCache.get(cacheNamespace, url);
  /* istanbul ignore next line */
  if (cachedResult) return cachedResult;
  try {
    const hash = await hasha.fromStream(got.stream(url), {
      algorithm: 'sha256',
    });
    const cacheMinutes = 3 * 24 * 60; // 3 days
    await renovateCache.set(cacheNamespace, url, hash, cacheMinutes);
    return hash;
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

async function getHashFromUrls(urls) {
  const hashes = (await Promise.all(
    urls.map(url => getHashFromUrl(url))
  )).filter(Boolean);
  const distinctHashes = [...new Set(hashes)];
  if (!distinctHashes.length) {
    logger.debug({ hashes }, 'Could not calculate hash for URLs');
    return null;
  }
  // istanbul ignore if
  if (distinctHashes.length > 1) {
    logger.warn({ urls }, 'Found multiple hashes for single def');
  }
  return distinctHashes[0];
}

function setNewHash(content, hash) {
  return content.replace(/(sha256\s*=\s*)"[^"]+"/, `$1"${hash}"`);
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
      newDef = updateWithNewVersion(
        upgrade.def,
        upgrade.currentValue,
        upgrade.newValue
      );
      const urls = extractUrls(newDef);
      if (!(urls && urls.length)) {
        logger.debug({ newDef }, 'urls is empty');
        return null;
      }
      const hash = await getHashFromUrls(urls);
      if (!hash) {
        return null;
      }
      logger.debug({ hash }, 'Calculated hash');
      newDef = setNewHash(newDef, hash);
    } else if (upgrade.depType === 'http_archive' && upgrade.newDigest) {
      const [, shortRepo] = upgrade.repo.split('/');
      const url = `https://github.com/${upgrade.repo}/archive/${upgrade.newDigest}.tar.gz`;
      const hash = await getHashFromUrl(url);
      newDef = setNewHash(upgrade.def, hash);
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
