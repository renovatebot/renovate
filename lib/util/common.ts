import { isNumber } from '@sindresorhus/is';
import JSON5 from 'json5';
import { parse as jsoncWeaverParse } from 'jsonc-weaver';
import type { JsonValue } from 'type-fest';
import { GlobalConfig } from '../config/global.ts';
import { InheritConfig, NOT_PRESENT } from '../config/inherit.ts';
import type { GlobalInheritableConfig } from '../config/types.ts';
import {
  AZURE_API_USING_HOST_TYPES,
  BITBUCKET_API_USING_HOST_TYPES,
  BITBUCKET_SERVER_API_USING_HOST_TYPES,
  FORGEJO_API_USING_HOST_TYPES,
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../constants/index.ts';
import { logger } from '../logger/index.ts';
import type { Nullish } from '../types/index.ts';
import * as hostRules from './host-rules.ts';
import { coerceObject } from './object.ts';
import { parseUrl } from './url.ts';

/**
 * Tries to detect the `platform` from a url.
 *
 * @param url the url to detect `platform` from
 * @returns matched `platform` if found, otherwise `null`
 */
export function detectPlatform(
  url: string,
):
  | 'azure'
  | 'bitbucket'
  | 'bitbucket-server'
  | 'forgejo'
  | 'gitea'
  | 'github'
  | 'gitlab'
  | null {
  const { hostname } = coerceObject(parseUrl(url));
  if (hostname === 'dev.azure.com' || hostname?.endsWith('.visualstudio.com')) {
    return 'azure';
  }
  if (hostname === 'bitbucket.org' || hostname === 'bitbucket.com') {
    return 'bitbucket';
  }
  if (hostname?.includes('bitbucket')) {
    return 'bitbucket-server';
  }
  if (hostname?.includes('forgejo')) {
    return 'forgejo';
  }
  if (hostname && ['codeberg.org', 'codefloe.com'].includes(hostname)) {
    return 'forgejo';
  }
  if (
    hostname &&
    (['gitea.com'].includes(hostname) || hostname.includes('gitea'))
  ) {
    return 'gitea';
  }
  if (hostname === 'github.com' || hostname?.includes('github')) {
    return 'github';
  }
  if (hostname === 'gitlab.com' || hostname?.includes('gitlab')) {
    return 'gitlab';
  }

  const hostType = hostRules.hostType({ url });

  if (!hostType) {
    return null;
  }

  if (AZURE_API_USING_HOST_TYPES.includes(hostType)) {
    return 'azure';
  }

  if (BITBUCKET_SERVER_API_USING_HOST_TYPES.includes(hostType)) {
    return 'bitbucket-server';
  }
  if (BITBUCKET_API_USING_HOST_TYPES.includes(hostType)) {
    return 'bitbucket';
  }
  if (FORGEJO_API_USING_HOST_TYPES.includes(hostType)) {
    return 'forgejo';
  }
  if (GITEA_API_USING_HOST_TYPES.includes(hostType)) {
    return 'gitea';
  }
  if (GITHUB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'github';
  }
  if (GITLAB_API_USING_HOST_TYPES.includes(hostType)) {
    return 'gitlab';
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
 * Splits host-stripped path segments into the repository and whatever follows it.
 *
 * Only platforms whose URL layout fixes the boundary are resolved. GitHub repos are
 * always `owner/repo`. Azure DevOps repos are `org/project/repo`, optionally spelled
 * `org/project/_git/repo`. Elsewhere — GitLab most notably — a project slug may span
 * any number of nested group segments, so the boundary is not knowable from the URL
 * and `null` is returned for the caller to resolve however its ecosystem does.
 */
export function splitRepositoryPath(
  platform: ReturnType<typeof detectPlatform>,
  segments: string[],
): { repository: string[]; subpath: string[] } | null {
  const boundary = repositoryBoundary(platform, segments);
  if (boundary === null || segments.length < boundary) {
    return null;
  }

  return {
    repository: segments.slice(0, boundary),
    subpath: segments.slice(boundary),
  };
}

function repositoryBoundary(
  platform: ReturnType<typeof detectPlatform>,
  segments: string[],
): number | null {
  if (platform === 'github') {
    return 2;
  }

  if (platform === 'azure') {
    const gitSegment = segments.indexOf('_git');
    return gitSegment === -1 ? 3 : gitSegment + 2;
  }

  return null;
}
