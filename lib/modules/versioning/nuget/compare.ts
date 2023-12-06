import type { NugetVersion } from './types';

function comparePrereleases(x: string, y: string): number {
  const xParts = x.split('.');
  const yParts = y.split('.');

  const maxLen = Math.max(xParts.length, yParts.length);
  for (let i = 0; i < maxLen; i += 1) {
    const xPart = xParts[i] ?? '';
    const yPart = yParts[i] ?? '';
    const xNum = Number(xPart);
    const yNum = Number(yPart);

    const res =
      !Number.isNaN(xNum) && !Number.isNaN(yNum)
        ? Math.sign(xNum - yNum)
        : xPart.localeCompare(yPart, undefined, { sensitivity: 'base' });

    if (res !== 0) {
      return res;
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
    return comparePrereleases(x.prerelease, y.prerelease);
  }

  return 0;
}
