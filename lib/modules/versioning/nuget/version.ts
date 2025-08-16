import { regEx } from '../../../util/regex';
import type { NugetVersion } from './types';

// We can't just use `Number.parseInt()` beacause it parses `123abc` as `123`,
// which leads to incorrect version comparison.
function ensureNumber(input: string): number | null {
  if (!regEx(/^\d+$/).test(input)) {
    return null;
  }

  return Number.parseInt(input);
}

function comparePrereleases(x: string, y: string): number {
  const xParts = x.split('.');
  const yParts = y.split('.');

  const maxLen = Math.max(xParts.length, yParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const xPart = xParts[i] ?? '';
    const yPart = yParts[i] ?? '';
    const xNum = ensureNumber(xPart);
    const yNum = ensureNumber(yPart);

    const res =
      xNum !== null && yNum !== null
        ? Math.sign(xNum - yNum)
        : xPart.localeCompare(yPart, undefined, { sensitivity: 'base' });

    if (res !== 0) {
      return res;
    }
  }

  return 0;
}

export function compare(x: NugetVersion, y: NugetVersion): number {
  const xMajor = x.major;
  const yMajor = y.major;

  const xMinor = x.minor ?? 0;
  const yMinor = y.minor ?? 0;

  const xPatch = x.patch ?? 0;
  const yPatch = y.patch ?? 0;

  const xRevision = x.revision ?? 0;
  const yRevision = y.revision ?? 0;

  if (xMajor !== yMajor) {
    return Math.sign(xMajor - yMajor);
  } else if (xMinor !== yMinor) {
    return Math.sign(xMinor - yMinor);
  } else if (xPatch !== yPatch) {
    return Math.sign(xPatch - yPatch);
  } else if (xRevision !== yRevision) {
    return Math.sign(xRevision - yRevision);
  } else if (x.prerelease && !y.prerelease) {
    return -1;
  } else if (!x.prerelease && y.prerelease) {
    return 1;
  } else if (x.prerelease && y.prerelease) {
    return comparePrereleases(x.prerelease, y.prerelease);
  }

  return 0;
}

export function versionToString(version: NugetVersion): string {
  let res = `${version.major}`;

  if (version.minor !== undefined) {
    res += `.${version.minor}`;
  }

  if (version.patch !== undefined) {
    res += `.${version.patch}`;
  }

  if (version.revision !== undefined) {
    res += `.${version.revision}`;
  }

  if (version.prerelease) {
    res += `-${version.prerelease}`;
  }

  if (version.metadata) {
    res += `+${version.metadata}`;
  }

  return res;
}
