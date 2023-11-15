import is from '@sindresorhus/is';
import { logger } from '../../logger';
import { stripEmojis } from '../../util/emoji';
import { toSha256 } from '../../util/hash';
import { regEx } from '../../util/regex';
import { fromBase64 } from '../../util/string';
import type { PrBodyStruct } from './types';

export const prDebugDataRe = regEx(
  /\n?<!--renovate-debug:(?<payload>.*?)-->\n?/,
);

const renovateConfigHashRe = regEx(
  /\n?<!--renovate-config-hash:(?<payload>.*?)-->\n?/,
);

const prCheckboxRe = regEx(/- (?<checkbox>\[[\sx]]) <!-- rebase-check -->/);

function noWhitespaceOrHeadings(input: string): string {
  return input.replace(regEx(/\r?\n|\r|\s|#/g), '');
}

const reviewableRegex = regEx(/\s*<!-- Reviewable:start -->/);

export function hashBody(body: string | undefined): string {
  let result = body?.trim() ?? '';
  result = result.replace(prDebugDataRe, '');
  const reviewableIndex = result.search(reviewableRegex);
  if (reviewableIndex > -1) {
    result = result.slice(0, reviewableIndex);
  }
  result = stripEmojis(result);
  result = noWhitespaceOrHeadings(result);
  result = toSha256(result);
  return result;
}

function isRebaseRequested(body: string): boolean | undefined {
  const match = prCheckboxRe.exec(body);
  if (!match) {
    return undefined;
  }
  return match.groups?.checkbox === '[x]';
}

export function getRenovateDebugPayload(body: string): string | undefined {
  const match = prDebugDataRe.exec(body);
  return match?.groups?.payload;
}

export function getRenovateConfigHashPayload(body: string): string | undefined {
  const match = renovateConfigHashRe.exec(body);
  return match?.groups?.payload;
}

export function getPrBodyStruct(
  input: string | undefined | null,
): PrBodyStruct {
  const body = input ?? '';
  const hash = hashBody(body);
  const result: PrBodyStruct = { hash };

  const rebaseRequested = isRebaseRequested(body);

  if (!is.undefined(rebaseRequested)) {
    result.rebaseRequested = rebaseRequested;
  }

  const rawConfigHash = getRenovateConfigHashPayload(body);
  if (rawConfigHash) {
    result.rawConfigHash = rawConfigHash;
  }

  const debugPayload = getRenovateDebugPayload(body);
  if (debugPayload) {
    try {
      result.debugData = JSON.parse(fromBase64(debugPayload));
    } catch (e) {
      logger.warn('Unable to read and parse debugData from the PR');
    }
  }
  return result;
}
