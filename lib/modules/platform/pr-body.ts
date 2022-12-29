import is from '@sindresorhus/is';
import hasha from 'hasha';
import { logger } from '../../logger';
import { stripEmojis } from '../../util/emoji';
import { regEx } from '../../util/regex';
import { fromBase64 } from '../../util/string';
import type { PrBodyStruct, RenovateBodyIndexes } from './types';

export const prDebugDataRe = regEx(
  /\n?<!--renovate-debug:(?<payload>.*?)-->\n?/
);

const renovateConfigHashRe = regEx(
  /\n?<!--renovate-config-hash:(?<payload>.*?)-->\n?/
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
  result = hasha(result, { algorithm: 'sha256' });
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

function getRenovateBodyIndexes(input: string): RenovateBodyIndexes {
  // we want to remove all the new lines and spaces after the start tag and also before the end tag (\s*).
  // use dedicated regular expressions for that
  const startRegex = regEx(/<!--renovate:start-->\s*/);
  const endRegex = regEx(/\s*<!--renovate:end-->/);
  const renovateBodyIndexes: RenovateBodyIndexes = {
    start: 0,
    startBody: 0,
    end: input.length,
    endBody: input.length,
  };
  const startMatch = startRegex.exec(input);
  const endMatch = endRegex.exec(input);
  if (startMatch) {
    renovateBodyIndexes.start = startMatch.index;
    renovateBodyIndexes.startBody = startMatch.index + startMatch[0].length;
  }
  if (endMatch) {
    renovateBodyIndexes.endBody = endMatch.index;
    renovateBodyIndexes.end = endMatch.index + endMatch[0].length;
  }
  return renovateBodyIndexes;
}

function getRenovateBody(input: string): string {
  const indexes = getRenovateBodyIndexes(input);
  const renovateBody = input.substring(indexes.startBody, indexes.endBody);
  return renovateBody.trim();
}

export function updateRenovateBody(
  newBody: string,
  existingBody: string
): string {
  const newBodyWithoutTags = getRenovateBody(newBody);
  const indexes = getRenovateBodyIndexes(existingBody);
  const prefix = existingBody.substring(0, indexes.startBody);
  const suffix = existingBody.substring(indexes.endBody);
  return prefix + newBodyWithoutTags + suffix;
}

export function getPrBodyStruct(
  input: string | undefined | null
): PrBodyStruct {
  const body = getRenovateBody(input ?? '');
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
