import type { NugetVersion } from '../nuget/types.ts';
import { compare as compareNuget } from '../nuget/version.ts';

export function sameReleaseParts(x: NugetVersion, y: NugetVersion): boolean {
  return (
    x.major === y.major &&
    (x.minor ?? 0) === (y.minor ?? 0) &&
    (x.patch ?? 0) === (y.patch ?? 0) &&
    (x.revision ?? 0) === (y.revision ?? 0)
  );
}

/**
 * NuGet ordering, plus the Paket rule that the literal `prerelease` suffix
 * sorts below any other prerelease of the same release version, so that
 * `1.2.3-prerelease` acts as an "any prerelease of 1.2.3" floor.
 */
export function compare(x: NugetVersion, y: NugetVersion): number {
  if (x.prerelease && y.prerelease && sameReleaseParts(x, y)) {
    const xSentinel = x.prerelease === 'prerelease';
    const ySentinel = y.prerelease === 'prerelease';
    if (xSentinel !== ySentinel) {
      return xSentinel ? -1 : 1;
    }
  }
  return compareNuget(x, y);
}
