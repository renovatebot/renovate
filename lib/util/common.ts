import { isNumber, isTruthy } from '@sindresorhus/is';
import JSON5 from 'json5';
import { parse as jsoncWeaverParse } from 'jsonc-weaver';
import type { JsonValue } from 'type-fest';
import { GlobalConfig } from '../config/global.ts';
import { InheritConfig, NOT_PRESENT } from '../config/inherit.ts';
import type { GlobalInheritableConfig } from '../config/types.ts';
import type { PlatformFamilyId } from '../constants/index.ts';
import { PLATFORM_FAMILIES } from '../constants/index.ts';
import { logger } from '../logger/index.ts';
import type { Nullish } from '../types/index.ts';
import { coerceArray } from './array.ts';
import * as hostRules from './host-rules.ts';
import { coerceObject } from './object.ts';
import { parseUrl } from './url.ts';

/**
 * Tries to detect the `platform` from a url.
 *
 * @param url the url to detect `platform` from
 * @returns matched `platform` if found, otherwise `null`
 */
export function detectPlatform(url: string): PlatformFamilyId | null {
  const { hostname } = coerceObject(parseUrl(url));
  if (hostname) {
    // Azure DevOps kept serving organizations from their Visual Studio Team
    // Services hostnames, which no other family can claim.
    if (hostname.endsWith('.visualstudio.com')) {
      return 'azure';
    }

    for (const [family, { knownHosts }] of Object.entries(PLATFORM_FAMILIES)) {
      if (knownHosts.includes(hostname)) {
        return family as PlatformFamilyId;
      }
    }

    // Anything else is matched by name, so a self-hosted instance which was
    // named after its vendor is recognized without a hostRule. Bitbucket is
    // tested first because a self-hosted Bitbucket is always Data Center.
    if (hostname.includes('bitbucket')) {
      return 'bitbucket-server';
    }
    if (hostname.includes('forgejo')) {
      return 'forgejo';
    }
    if (hostname.includes('gitea')) {
      return 'gitea';
    }
    if (hostname.includes('github')) {
      return 'github';
    }
    if (hostname.includes('gitlab')) {
      return 'gitlab';
    }
  }

  const hostType = hostRules.hostType({ url });

  if (!hostType) {
    return null;
  }

  for (const [family, { apiUsingHostTypes }] of Object.entries(
    PLATFORM_FAMILIES,
  )) {
    if (apiUsingHostTypes.includes(hostType)) {
      return family as PlatformFamilyId;
    }
  }

  return null;
}

export function noLeadingAtSymbol(input: string): string {
  return input.startsWith('@') ? input.slice(1) : input;
}

export function parseJson(
  content: Nullish<string>,
  filename: string,
): JsonValue {
  if (!content) {
    return null;
  }

  if (filename.endsWith('.jsonc')) {
    return parseJsonc(content);
  }

  if (filename.endsWith('.json5')) {
    return JSON5.parse(content);
  }

  return parseJsonWithFallback(content, filename);
}

export function parseJsonWithFallback(
  content: string,
  context: string,
): JsonValue {
  let parsedJson: JsonValue;

  try {
    parsedJson = parseJsonc(content);
  } catch {
    // warn if json5 format used in json
    parsedJson = JSON5.parse(content);
    logger.warn(
      { context },
      'File contents are invalid JSONC but parse using JSON5. Support for this will be removed in a future release so please change to a support .json5 file name or ensure correct JSON syntax.',
    );
  }

  return parsedJson;
}

export function parseJsonc(content: string): JsonValue {
  return jsoncWeaverParse(content);
}

/**
 * Use only if an option is inherited + globalOnly
 * For globalOnly options use GlobalConfig.get
 */
export function getInheritedOrGlobal<Key extends keyof GlobalInheritableConfig>(
  key: Key,
): GlobalInheritableConfig[Key] {
  const inheritedValue = InheritConfig.get(key);
  const globalValue = GlobalConfig.get(key);
  if (inheritedValue !== NOT_PRESENT) {
    // Don't allow inherited config to make `onboardingAutoCloseAge` a higher value than our global setting
    if (
      key === 'onboardingAutoCloseAge' &&
      isNumber(inheritedValue) &&
      isNumber(globalValue) &&
      globalValue < inheritedValue
    ) {
      return globalValue;
    }

    return inheritedValue;
  }

  return globalValue;
}

/**
 * The repository path within a URL's host, or `null` when the platform's own layout
 * does not fix where the repository ends - GitLab's nested groups most notably -
 * leaving the caller to apply whatever rule its ecosystem defines.
 *
 * `parseGitUrl` cannot answer this: it reads the last path segment as the repository
 * name, so a URL which continues past the repository is misread rather than split.
 */
export function getRepositoryPath(
  platform: PlatformFamilyId | null,
  url: string,
): string | null {
  if (!platform) {
    return null;
  }

  const { pathname } = coerceObject(parseUrl(url));
  const segments = coerceArray(pathname?.split('/')).filter(isTruthy);

  return PLATFORM_FAMILIES[platform].repositoryPath(segments);
}
