import hasha from 'hasha';
import { stripEmojis } from '../../util/emoji';
import { regEx } from '../../util/regex';
import { fromBase64 } from '../../util/string';
import type { PrBodyStruct } from './types';

export const prDebugDataRe = regEx(/<!--renovate-debug:(?<payload>.*?)-->/s);

function noWhitespaceOrHeadings(input: string): string {
  return input.replace(regEx(/\r?\n|\r|\s|#/g), '');
}

const reviewableRegex = regEx(/\s*<!-- Reviewable:start -->/);

export function hashBody(body: string | undefined): string {
  let result = body?.trim() ?? '';
  const reviewableIndex = result.search(reviewableRegex);
  if (reviewableIndex > -1) {
    result = result.slice(0, reviewableIndex);
  }
  result = stripEmojis(result);
  result = noWhitespaceOrHeadings(result);
  result = hasha(result, { algorithm: 'sha256' });
  return result;
}

function isRebaseRequested(body: string | undefined): boolean {
  return !!body?.includes(`- [x] <!-- rebase-check -->`);
}

export function getRenovateDebugPayload(body: string): string | undefined {
  const match = prDebugDataRe.exec(body);
  return match?.groups?.payload;
}

export function getPrBodyStruct(
  input: string | undefined | null
): PrBodyStruct {
  const body = input ?? '';
  const hash = hashBody(body);
  const result: PrBodyStruct = { hash };

  const rebaseRequested = isRebaseRequested(body);
  if (rebaseRequested) {
    result.rebaseRequested = rebaseRequested;
  }

  const debugPayload = getRenovateDebugPayload(body);
  if (debugPayload) {
    result.debugData = JSON.parse(fromBase64(debugPayload));
  }
  return result;
}
