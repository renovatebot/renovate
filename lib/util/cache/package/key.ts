import type { CombinedKey, PackageCacheNamespace } from './types';

export function splitIdentifier(identifier: string): string[] {
  const result: string[] = [];

  let isPrevUpper = false;

  let wordStart = 0;
  for (let i = 0; i < identifier.length; i += 1) {
    const char = identifier[i];
    const charLower = char.toLocaleLowerCase();
    const isUpper = char !== charLower;

    if (isUpper === false && isPrevUpper && i - wordStart > 1) {
      const prevIdx = i - 1;
      result.push(identifier.slice(wordStart, prevIdx));
      wordStart = prevIdx;
    }

    if (isUpper && !isPrevUpper && wordStart !== i) {
      result.push(identifier.slice(wordStart, i));
      wordStart = i;
    }

    isPrevUpper = isUpper;
  }

  if (wordStart < identifier.length) {
    result.push(identifier.slice(wordStart));
  }

  return result;
}

export function classNameToCacheNamespace(className: string): string {
  const parts = splitIdentifier(className).map((id) => id.toLocaleLowerCase());
  const lastPart = parts.pop();

  if (lastPart === 'datasource') {
    return [lastPart, ...parts].join('-');
  }

  return [...parts, lastPart].join('-');
}

/**
 * Returns the key used by underlying storage implementations
 */
export function getCombinedKey(
  namespace: PackageCacheNamespace,
  key: string,
): CombinedKey {
  return `global%%${namespace}%%${key}`;
}
