import JSON5 from 'json5';
import * as JSONC from 'jsonc-parser';
import type { JsonValue } from 'type-fest';
import {
  BITBUCKET_API_USING_HOST_TYPES,
  BITBUCKET_SERVER_API_USING_HOST_TYPES,
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../constants';
import { logger } from '../logger';
import * as hostRules from './host-rules';
import { parseUrl } from './url';

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
  | 'gitea'
  | 'github'
  | 'gitlab'
  | null {
  const { hostname } = parseUrl(url) ?? {};
  if (hostname === 'dev.azure.com' || hostname?.endsWith('.visualstudio.com')) {
    return 'azure';
  }
  if (hostname === 'bitbucket.org' || hostname === 'bitbucket.com') {
    return 'bitbucket';
  }
  if (hostname?.includes('bitbucket')) {
    return 'bitbucket-server';
  }
  if (
    hostname &&
    (['gitea.com', 'codeberg.org'].includes(hostname) ||
      hostname.includes('gitea') ||
      hostname.includes('forgejo'))
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

  if (BITBUCKET_SERVER_API_USING_HOST_TYPES.includes(hostType)) {
    return 'bitbucket-server';
  }
  if (BITBUCKET_API_USING_HOST_TYPES.includes(hostType)) {
    return 'bitbucket';
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

export function parseJson(content: string | null, filename: string): JsonValue {
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
  const errors: JSONC.ParseError[] = [];
  const value = JSONC.parse(content, errors, { allowTrailingComma: true });
  if (errors.length === 0) {
    return value;
  }
  throw new Error('Invalid JSONC');
}
