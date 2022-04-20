import hasha from 'hasha';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { Http } from '../../../util/http';
import { regEx } from '../../../util/regex';
import type { UpdateDependencyConfig } from '../types';
import type { BazelManagerData } from './types';

const http = new Http('bazel');

function updateWithNewVersion(
  content: string,
  currentValue: string,
  newValue: string
): string {
  const replaceFrom = currentValue.replace(regEx(/^v/), '');
  const replaceTo = newValue.replace(regEx(/^v/), '');
  let newContent = content;
  do {
    newContent = newContent.replace(replaceFrom, replaceTo);
  } while (newContent.includes(replaceFrom));
  return newContent;
}

function extractUrl(flattened: string): string[] | null {
  const urlMatch = regEx(/url="(.*?)"/).exec(flattened);
  if (!urlMatch) {
    logger.debug('Cannot locate urls in new definition');
    return null;
  }
  return [urlMatch[1]];
}

function extractUrls(content: string): string[] | null {
  const flattened = content.replace(regEx(/\n/g), '').replace(regEx(/\s/g), '');
  const urlsMatch = regEx(/urls?=\[.*?\]/).exec(flattened);
  if (!urlsMatch) {
    return extractUrl(flattened);
  }
  const urls = urlsMatch[0]
    .replace(regEx(/urls?=\[/), '')
    .replace(regEx(/,?\]$/), '')
    .split(',')
    .map((url) => url.replace(regEx(/"/g), ''));
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
    const hash = await hasha.fromStream(http.stream(url), {
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
  return content.replace(regEx(/(sha256\s*=\s*)"[^"]+"/), `$1"${hash}"`);
}

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig<BazelManagerData>): Promise<string | null> {
  try {
    logger.debug(
      `bazel.updateDependency(): ${upgrade.newValue || upgrade.newDigest}`
    );
    let newDef: string | undefined;
    if (upgrade.depType === 'container_pull' && upgrade.managerData?.def) {
      newDef = upgrade.managerData.def
        .replace(regEx(/(tag\s*=\s*)"[^"]+"/), `$1"${upgrade.newValue}"`)
        .replace(regEx(/(digest\s*=\s*)"[^"]+"/), `$1"${upgrade.newDigest}"`);
    }
    if (
      (upgrade.depType === 'git_repository' ||
        upgrade.depType === 'go_repository') &&
      upgrade.managerData?.def
    ) {
      newDef = upgrade.managerData.def
        .replace(regEx(/(tag\s*=\s*)"[^"]+"/), `$1"${upgrade.newValue}"`)
        .replace(regEx(/(commit\s*=\s*)"[^"]+"/), `$1"${upgrade.newDigest}"`);
      if (upgrade.currentDigest && upgrade.updateType !== 'digest') {
        newDef = newDef.replace(
          regEx(/(commit\s*=\s*)"[^"]+".*?\n/),
          `$1"${upgrade.newDigest}",  # ${upgrade.newValue}\n`
        );
      }
    } else if (
      (upgrade.depType === 'http_archive' || upgrade.depType === 'http_file') &&
      upgrade.managerData?.def &&
      (upgrade.currentValue || upgrade.currentDigest) &&
      (upgrade.newValue ?? upgrade.newDigest)
    ) {
      newDef = updateWithNewVersion(
        upgrade.managerData.def,
        (upgrade.currentValue ?? upgrade.currentDigest)!,
        (upgrade.newValue ?? upgrade.newDigest)!
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
    logger.debug({ oldDef: upgrade.managerData?.def, newDef });

    // istanbul ignore if: needs test
    if (!newDef) {
      return null;
    }

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
