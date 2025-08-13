import type { Parts } from './types';

export function extractAllParts(version: string): number[] | null {
  const parts = version.split('.').map((x) => parseInt(x));
  const ret: number[] = [];
  for (const l of parts) {
    if (l < 0 || !isFinite(l)) {
      return null;
    }
    ret.push(l);
  }
  return ret;
}

export function getParts(splitOne: string): Parts | null {
  const c = extractAllParts(splitOne);
  if (c === null) {
    return null;
  }
  return {
    major: c.slice(0, 2),
    minor: c.slice(2, 3),
    patch: c.slice(3),
  };
}

export function plusOne(majorOne: number[]): string {
  return `${majorOne[0]}.${majorOne[1] + 1}`;
}

export function compareIntArray(
  versionPartsInt: number[],
  otherPartsInt: number[],
): 'lt' | 'eq' | 'gt' {
  for (
    let i = 0;
    i < Math.min(versionPartsInt.length, otherPartsInt.length);
    i++
  ) {
    if (versionPartsInt[i] > otherPartsInt[i]) {
      return 'gt';
    }
    if (versionPartsInt[i] < otherPartsInt[i]) {
      return 'lt';
    }
  }
  if (versionPartsInt.length === otherPartsInt.length) {
    return 'eq';
  }
  if (versionPartsInt.length > otherPartsInt.length) {
    return 'gt';
  }
  return 'lt';
}
