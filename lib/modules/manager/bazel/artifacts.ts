import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import * as packageCache from '../../../util/cache/package';
import { hashStream } from '../../../util/hash';
import { Http } from '../../../util/http';
import { map as pMap } from '../../../util/promises';
import { regEx } from '../../../util/regex';
import type {
  ArtifactError,
  UpdateArtifact,
  UpdateArtifactsResult,
  Upgrade,
} from '../types';
import { findCodeFragment, patchCodeAtFragments, updateCode } from './common';
import type { RecordFragment, StringFragment } from './types';

const http = new Http('bazel');

function getUrlFragments(rule: RecordFragment): StringFragment[] {
  const urls: StringFragment[] = [];

  const urlRecord = rule.children.url;
  if (urlRecord?.type === 'string') {
    urls.push(urlRecord);
  }

  const urlsRecord = rule.children.urls;
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

function migrateUrl(url: string, upgrade: Upgrade): string {
  const newValue = upgrade.newValue?.replace(regEx(/^v/), '');

  // @see https://github.com/bazelbuild/rules_webtesting/releases/tag/0.3.5
  // @see https://github.com/bazelbuild/rules_webtesting/releases/tag/0.4.0
  if (
    url.endsWith('/rules_webtesting.tar.gz') &&
    !newValue?.match(regEx(/^0\.[0123]\./))
  ) {
    return url.replace(regEx(/\.tar\.gz$/), `-${newValue}.tar.gz`);
  }

  return url;
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
  } catch /* istanbul ignore next */ {
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
  const oldContents = updateArtifact.newPackageFileContent;
  let newContents = oldContents;
  const artifactErrors: ArtifactError[] = [];
  for (const upgrade of upgrades) {
    const { managerData } = upgrade;
    const idx = managerData?.idx as number;

    if (upgrade.depType === 'http_file' || upgrade.depType === 'http_archive') {
      const rule = findCodeFragment(newContents, [idx]);
      /* v8 ignore start -- used only for type narrowing */
      if (rule?.type !== 'record') {
        continue;
      } /* v8 ignore stop */

      const urlFragments = getUrlFragments(rule);
      if (!urlFragments?.length) {
        logger.debug(`def: ${rule.value}, urls is empty`);
        continue;
      }

      const updateValues = (oldUrl: string): string => {
        let url = oldUrl;
        url = replaceValues(url, upgrade.currentValue, upgrade.newValue);
        url = replaceValues(url, upgrade.currentDigest, upgrade.newDigest);
        url = migrateUrl(url, upgrade);
        return url;
      };

      const urls = urlFragments.map(({ value }) => updateValues(value));
      const hash = await getHashFromUrls(urls);
      if (!hash) {
        if (urlFragments.length >= 1) {
          artifactErrors.push({
            fileName: path,
            stderr: `Could not calculate sha256 for ${upgrade.depName} at ${upgrade.newValue}. Checked URLs: ${urls.join(', ')}`,
          });
        }
        continue;
      }

      newContents = patchCodeAtFragments(
        newContents,
        urlFragments,
        updateValues,
      );
      newContents = updateCode(
        newContents,
        [idx, 'strip_prefix'],
        updateValues,
      );
      newContents = updateCode(newContents, [idx, 'sha256'], hash);
    }
  }

  if (oldContents === newContents) {
    if (artifactErrors.length) {
      // If we have artifact errors, return them even if we have file changes
      return artifactErrors.map((error) => ({
        artifactError: error,
      }));
    }
    return null;
  }

  return [
    {
      file: {
        type: 'addition',
        path,
        contents: newContents,
      },
    },
  ];
}
