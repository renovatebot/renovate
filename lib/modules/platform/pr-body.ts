import hasha from 'hasha';
import { stripEmojis } from '../../util/emoji';
import { regEx } from '../../util/regex';
import type { PrBodyStruct } from './types';

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
  result = result.trim();
  result = hasha(result, { algorithm: 'sha256' });
  return result;
}

export function getReviewableSection(input: string): string | null {
  const index = input.search(reviewableRegex);
  if (index > -1) {
    return input.slice(index);
  }
  return null;
}

export function isRebaseRequested(body: string | undefined): boolean {
  return !!body?.includes(`- [x] <!-- rebase-check -->`);
}

export function getPrBodyStruct(
  input: string | undefined | null
): PrBodyStruct {
  const str = input ?? '';
  const hash = hashBody(str);
  const result: PrBodyStruct = { hash };

  const rebaseRequested = isRebaseRequested(str);
  if (rebaseRequested) {
    result.rebaseRequested = rebaseRequested;
  }

  const reviewableSection = getReviewableSection(str);
  if (reviewableSection) {
    result.reviewableSection = reviewableSection;
  }

  return result;
}
