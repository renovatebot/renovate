import { regEx } from '../../../util/regex';
import type { NugetVersion } from './types';

function num(input: string | undefined): number | undefined {
  return input?.match(regEx(/^\d+$/)) ? Number.parseInt(input, 10) : undefined;
}

function comparePrereleases(x: string, y: string): number {
  const xParts = x.split('.');
  const yParts = y.split('.');

  const maxLen = Math.max(xParts.length, yParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const xPart = xParts[i] ?? '';
    const yPart = yParts[i] ?? '';

    const xNum = num(xPart);
    const yNum = num(yPart);
    if (xNum !== undefined && yNum !== undefined) {
      const numCmp = Math.sign(xNum - yNum);
      if (numCmp !== 0) {
        return numCmp;
      }
    }

    const strCmp = xPart.localeCompare(yPart);
    if (strCmp !== 0) {
      return strCmp;
    }
  }

  return 0;
}

export function cmp(x: NugetVersion, y: NugetVersion): number {
  if (x.major !== y.major) {
    return Math.sign(x.major - y.major);
  } else if (x.minor !== y.minor) {
    return Math.sign(x.minor - y.minor);
  } else if (x.patch !== y.patch) {
    return Math.sign(x.patch - y.patch);
  } else if (x.revision !== y.revision) {
    return Math.sign(x.revision - y.revision);
  } else if (x.prerelease && !y.prerelease) {
    return -1;
  } else if (!x.prerelease && y.prerelease) {
    return 1;
  } else if (x.prerelease && y.prerelease) {
    return x.prerelease.localeCompare(y.prerelease, undefined, { numeric: true });
  }

  return 0;
}
