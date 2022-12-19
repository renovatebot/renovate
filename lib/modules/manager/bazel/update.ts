import is from '@sindresorhus/is';
import hasha from 'hasha';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { Http } from '../../../util/http';
import { map as pMap } from '../../../util/promises';
import { regEx } from '../../../util/regex';
import type { UpdateDependencyConfig } from '../types';
import { findCodeFragment, patchCodeAtFragments, updateCode } from './common';
import type { BazelManagerData, RecordFragment, StringFragment } from './types';

const http = new Http('bazel');

function getUrlFragments(rule: RecordFragment): StringFragment[] {
  const urls: StringFragment[] = [];

  const urlRecord = rule.children['url'];
  if (urlRecord?.type === 'string') {
    urls.push(urlRecord);
  }

  const urlsRecord = rule.children['urls'];
  if (urlsRecord?.type === 'array') {
    for (const urlRecord of urlsRecord.children) {
      if (urlRecord.type === 'string') {
        urls.push(urlRecord);
      }
    }
  }

  return urls;
}

const urlMassages = {
  'bazel-skylib.': 'bazel_skylib-',
  '/bazel-gazelle/releases/download/0': '/bazel-gazelle/releases/download/v0',
  '/bazel-gazelle-0': '/bazel-gazelle-v0',
  '/rules_go/releases/download/0': '/rules_go/releases/download/v0',
  '/rules_go-0': '/rules_go-v0',
};

function massageUrl(url: string): string {
  let result = url;
  for (const [from, to] of Object.entries(urlMassages)) {
    result = result.replace(from, to);
  }
  return result;
}

function replaceAll(input: string, from: string, to: string): string {
  return input.split(from).join(to);
}

function replaceValues(
  content: string,
  from: string | null | undefined,
  to: string | null | undefined
): string {
  // istanbul ignore if
  if (!from || !to || from === to) {
    return content;
  }
  const massagedFrom = from.replace(regEx(/^v/), '');
  const massagedTo = to.replace(regEx(/^v/), '');
  return replaceAll(content, massagedFrom, massagedTo);
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
    await pMap(urls, (url) => getHashFromUrl(massageUrl(url)))
  ).filter(is.truthy);
  if (!hashes.length) {
    logger.debug({ urls }, 'Could not calculate hash for URLs');
    return null;
  }

  const distinctHashes = new Set(hashes);
  // istanbul ignore if
  if (distinctHashes.size > 1) {
    logger.warn({ urls }, 'Found multiple hashes for single def');
  }

  return hashes[0];
}

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig<BazelManagerData>): Promise<string | null> {
  try {
    const { newValue, newDigest } = upgrade;
    logger.debug({ newValue, newDigest }, `bazel.updateDependency()`);
    const idx = upgrade.managerData!.idx;

    if (upgrade.depType === 'container_pull') {
      let result = fileContent;

      if (newValue) {
        result = updateCode(result, [idx, 'tag'], newValue);
      }

      if (newDigest) {
        result = updateCode(result, [idx, 'digest'], newDigest);
      }

      return result;
    }

    if (
      upgrade.depType === 'git_repository' ||
      upgrade.depType === 'go_repository'
    ) {
      let result = fileContent;

      if (newValue) {
        result = updateCode(result, [idx, 'tag'], newValue);
      }

      if (newDigest) {
        result = updateCode(result, [idx, 'commit'], newDigest);
      }

      return result;
    }

    if (upgrade.depType === 'http_file' || upgrade.depType === 'http_archive') {
      const rule = findCodeFragment(fileContent, [idx]);
      // istanbul ignore if
      if (rule?.type !== 'record') {
        return null;
      }

      const urlFragments = getUrlFragments(rule);
      if (!urlFragments?.length) {
        logger.debug(`def: ${rule.value}, urls is empty`);
        return null;
      }

      const updateValues = (oldUrl: string): string => {
        let url = oldUrl;
        url = replaceValues(url, upgrade.currentValue, upgrade.newValue);
        url = replaceValues(url, upgrade.currentDigest, upgrade.newDigest);
        return url;
      };

      const urls = urlFragments.map(({ value }) => updateValues(value));
      const hash = await getHashFromUrls(urls);
      if (!hash) {
        return null;
      }

      let result = fileContent;
      result = patchCodeAtFragments(result, urlFragments, updateValues);
      result = updateCode(result, [idx, 'strip_prefix'], updateValues);
      result = updateCode(result, [idx, 'sha256'], hash);
      return result;
    }
  } catch (err) /* istanbul ignore next */ {
    logger.debug({ err }, 'Error setting new bazel WORKSPACE version');
  }

  // istanbul ignore next
  return null;
}
