import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { hashStream } from '../../../util/hash';
import { Http } from '../../../util/http';
import { map as pMap } from '../../../util/promises';
import { regEx } from '../../../util/regex';
import type { UpdateArtifact, UpdateArtifactsResult } from '../types';
import { findCodeFragment, patchCodeAtFragments, updateCode } from './common';
import type { RecordFragment, StringFragment } from './types';

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
  to: string | null | undefined,
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
    url,
  );
  /* istanbul ignore next line */
  if (cachedResult) {
    return cachedResult;
  }
  try {
    const hash = await hashStream(http.stream(url), 'sha256');
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

export async function updateArtifacts(
  updateArtifact: UpdateArtifact,
): Promise<UpdateArtifactsResult[] | null> {
  const { packageFileName: path, updatedDeps: upgrades } = updateArtifact;
  let { newPackageFileContent: contents } = updateArtifact;
  for (const upgrade of upgrades) {
    const { managerData } = upgrade;
    const idx = managerData?.idx as number;

    if (upgrade.depType === 'http_file' || upgrade.depType === 'http_archive') {
      const rule = findCodeFragment(contents, [idx]);
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

      contents = patchCodeAtFragments(contents, urlFragments, updateValues);
      contents = updateCode(contents, [idx, 'strip_prefix'], updateValues);
      contents = updateCode(contents, [idx, 'sha256'], hash);
    }
  }

  return [
    {
      file: {
        type: 'addition',
        path,
        contents,
      },
    },
  ];
}
