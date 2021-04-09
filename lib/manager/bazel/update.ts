import { fromStream } from 'hasha';
import { logger } from '../../logger';
import * as packageCache from '../../util/cache/package';
import { Http } from '../../util/http';
import { regEx } from '../../util/regex';
import type { UpdateDependencyConfig } from '../types';

const http = new Http('bazel');

function updateWithNewVersion(
  content: string,
  currentValue: string,
  newValue: string
): string {
  const replaceFrom = currentValue.replace(/^v/, '');
  const replaceTo = newValue.replace(/^v/, '');
  let newContent = content;
  do {
    newContent = newContent.replace(replaceFrom, replaceTo);
  } while (newContent.includes(replaceFrom));
  return newContent;
}

function extractUrl(flattened: string): string[] | null {
  const urlMatch = /url="(.*?)"/.exec(flattened);
  if (!urlMatch) {
    logger.debug('Cannot locate urls in new definition');
    return null;
  }
  return [urlMatch[1]];
}

function extractUrls(content: string): string[] | null {
  const flattened = content.replace(/\n/g, '').replace(/\s/g, '');
  const urlsMatch = /urls?=\[.*?\]/.exec(flattened);
  if (!urlsMatch) {
    return extractUrl(flattened);
  }
  const urls = urlsMatch[0]
    .replace(/urls?=\[/, '')
    .replace(/,?\]$/, '')
    .split(',')
    .map((url) => url.replace(/"/g, ''));
  return urls;
}

async function getHashFromUrl(url: string): Promise<string | null> {
  const cacheNamespace = 'url-sha256';
  const cachedResult = await packageCache.get<string | null>(
    cacheNamespace,
    url
  );
  /* istanbul ignore next line */
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const hash = await fromStream(http.stream(url), {
      algorithm: 'sha256',
    });
    const cacheMinutes = 3 * 24 * 60; // 3 days
    await packageCache.set(cacheNamespace, url, hash, cacheMinutes);
    return hash;
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

async function getHashFromUrls(urls: string[]): Promise<string | null> {
  const hashes = (
    await Promise.all(urls.map((url) => getHashFromUrl(url)))
  ).filter(Boolean);
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

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
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
    } else if (
      upgrade.depType === 'http_archive' ||
      upgrade.depType === 'http_file'
    ) {
      newDef = updateWithNewVersion(
        upgrade.managerData.def,
        upgrade.currentValue || upgrade.currentDigest,
        upgrade.newValue || upgrade.newDigest
      );
      const massages = {
        'bazel-skylib.': 'bazel_skylib-',
        '/bazel-gazelle/releases/download/0':
          '/bazel-gazelle/releases/download/v0',
        '/bazel-gazelle-0': '/bazel-gazelle-v0',
        '/rules_go/releases/download/0': '/rules_go/releases/download/v0',
        '/rules_go-0': '/rules_go-v0',
      };
      for (const [from, to] of Object.entries(massages)) {
        newDef = newDef.replace(from, to);
      }
      const urls = extractUrls(newDef);
      if (!urls?.length) {
        logger.debug({ newDef }, 'urls is empty');
        return null;
      }
      const hash = await getHashFromUrls(urls);
      if (!hash) {
        return null;
      }
      logger.debug({ hash }, 'Calculated hash');
      newDef = setNewHash(newDef, hash);
    }
    logger.debug({ oldDef: upgrade.managerData.def, newDef });
    let existingRegExStr = `${upgrade.depType}\\([^\\)]+name\\s*=\\s*"${upgrade.depName}"(.*\\n)+?\\s*\\)`;
    if (newDef.endsWith('\n')) {
      existingRegExStr += '\n';
    }
    const existingDef = regEx(existingRegExStr);
    // istanbul ignore if
    if (!existingDef.test(fileContent)) {
      logger.debug('Cannot match existing string');
      return null;
    }
    return fileContent.replace(existingDef, newDef);
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Error setting new bazel WORKSPACE version');
    return null;
  }
}
