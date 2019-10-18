import { fromStream } from 'hasha';
import got from '../../util/got';
import { logger } from '../../logger';
import { Upgrade } from '../common';
import { regEx } from '../../util/regex';

function updateWithNewVersion(
  content: string,
  currentValue: string,
  newValue: string
): string {
  const currentVersion = currentValue.replace(/^v/, '');
  const newVersion = newValue.replace(/^v/, '');
  let newContent = content;
  do {
    newContent = newContent.replace(currentVersion, newVersion);
  } while (newContent.includes(currentVersion));
  return newContent;
}

function extractUrl(flattened: string): string[] | null {
  const urlMatch = flattened.match(/url="(.*?)"/);
  if (!urlMatch) {
    logger.debug('Cannot locate urls in new definition');
    return null;
  }
  return [urlMatch[1]];
}

function extractUrls(content: string): string[] | null {
  const flattened = content.replace(/\n/g, '').replace(/\s/g, '');
  const urlsMatch = flattened.match(/urls?=\[.*?\]/);
  if (!urlsMatch) {
    return extractUrl(flattened);
  }
  const urls = urlsMatch[0]
    .replace(/urls?=\[/, '')
    .replace(/,?\]$/, '')
    .split(',')
    .map(url => url.replace(/"/g, ''));
  return urls;
}

async function getHashFromUrl(url: string): Promise<string | null> {
  const cacheNamespace = 'url-sha256';
  const cachedResult = await renovateCache.get<string | null>(
    cacheNamespace,
    url
  );
  /* istanbul ignore next line */
  if (cachedResult) return cachedResult;
  try {
    const hash = await fromStream(got.stream(url), {
      algorithm: 'sha256',
    });
    const cacheMinutes = 3 * 24 * 60; // 3 days
    await renovateCache.set(cacheNamespace, url, hash, cacheMinutes);
    return hash;
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

async function getHashFromUrls(urls: string[]): Promise<string | null> {
  const hashes = (await Promise.all(
    urls.map(url => getHashFromUrl(url))
  )).filter(Boolean);
  const distinctHashes = [...new Set(hashes)];
  if (!distinctHashes.length) {
    logger.debug({ hashes, urls }, 'Could not calculate hash for URLs');
    return null;
  }
  // istanbul ignore if
  if (distinctHashes.length > 1) {
    logger.warn({ urls }, 'Found multiple hashes for single def');
  }
  return distinctHashes[0];
}

function setNewHash(content: string, hash: string): string {
  return content.replace(/(sha256\s*=\s*)"[^"]+"/, `$1"${hash}"`);
}

export async function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): Promise<string | null> {
  try {
    logger.debug(
      `bazel.updateDependency(): ${upgrade.newValue || upgrade.newDigest}`
    );
    let newDef: string;
    if (upgrade.depType === 'container_pull') {
      newDef = upgrade.managerData.def
        .replace(/(tag\s*=\s*)"[^"]+"/, `$1"${upgrade.newValue}"`)
        .replace(/(digest\s*=\s*)"[^"]+"/, `$1"${upgrade.newDigest}"`);
    }
    if (
      upgrade.depType === 'git_repository' ||
      upgrade.depType === 'go_repository'
    ) {
      newDef = upgrade.managerData.def
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
        upgrade.managerData.def,
        upgrade.currentValue,
        upgrade.newValue
      );
      const massages = {
        'bazel-skylib.0.9.0': 'bazel_skylib-0.9.0',
        '0.19.5/rules_go-0.19.5.tar.gz': 'v0.19.5/rules_go-v0.19.5.tar.gz',
      };
      for (const [from, to] of Object.entries(massages)) {
        newDef = newDef.replace(from, to);
      }
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
      newDef = setNewHash(upgrade.managerData.def, hash);
      newDef = newDef.replace(
        regEx(`(strip_prefix\\s*=\\s*)"[^"]*"`),
        `$1"${shortRepo}-${upgrade.newDigest}"`
      );
      const match =
        upgrade.managerData.def.match(/(?<=archive\/).*(?=\.tar\.gz)/g) || [];
      match.forEach(matchedHash => {
        newDef = newDef.replace(matchedHash, upgrade.newDigest);
      });
    }
    logger.debug({ oldDef: upgrade.managerData.def, newDef });
    let existingRegExStr = `${upgrade.depType}\\([^\\)]+name\\s*=\\s*"${upgrade.depName}"(.*\\n)+?\\s*\\)`;
    if (newDef.endsWith('\n')) {
      existingRegExStr += '\n';
    }
    const existingDef = regEx(existingRegExStr);
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
