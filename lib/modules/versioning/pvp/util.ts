import type { Components } from './types';

export function extractAllComponents(version: string): number[] | null {
  const versionMajor = version.split('.');
  const versionIntMajor = versionMajor.map((x) => parseInt(x, 10));
  const ret: number[] = [];
  for (const l of versionIntMajor) {
    if (l < 0 || !isFinite(l)) {
      return null;
    }
    ret.push(l);
  }
  return ret;
}

export function getComponents(splitOne: string): Components | null {
  const c = extractAllComponents(splitOne);
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
  versionIntMajor: number[],
  otherIntMajor: number[],
): 'lt' | 'eq' | 'gt' {
  for (
    let i = 0;
    i < Math.min(versionIntMajor.length, otherIntMajor.length);
    i++
  ) {
    if (versionIntMajor[i] > otherIntMajor[i]) {
      return 'gt';
    }
    if (versionIntMajor[i] < otherIntMajor[i]) {
      return 'lt';
    }
  }
  if (versionIntMajor.length === otherIntMajor.length) {
    return 'eq';
  }
  if (versionIntMajor.length > otherIntMajor.length) {
    return 'gt';
  }
  return 'lt';
}
