import { isObject } from '@sindresorhus/is';
import type { ToolchainObject } from './types.ts';

/**
 * Compare two parsed toolchain objects for sorting.
 *
 * @returns negative if a < b, positive if a > b, 0 if equal
 */
export function sortParsed(
  parsedA: ToolchainObject,
  parsedB: ToolchainObject,
): number {
  const channelA = parsedA.channel;
  const channelB = parsedB.channel;

  // Nightlies are always greater than versioned releases
  const isANightly = channelA === 'nightly';
  const isBNightly = channelB === 'nightly';

  if (isANightly && !isBNightly) {
    return 1;
  } else if (!isANightly && isBNightly) {
    return -1;
  }

  // Both nightlies -> compare by date
  if (isANightly && isBNightly && parsedA.date && parsedB.date) {
    const dateA = parsedA.date;
    const dateB = parsedB.date;

    if (dateA.year !== dateB.year) {
      return dateA.year - dateB.year;
    } else if (dateA.month !== dateB.month) {
      return dateA.month - dateB.month;
    } else if (dateA.day !== dateB.day) {
      return dateA.day - dateB.day;
    }

    return 0;
  }

  // Both versioned -> compare by semver
  if (isObject(channelA) && isObject(channelB)) {
    if (channelA.major !== channelB.major) {
      return channelA.major - channelB.major;
    }
    if (channelA.minor !== channelB.minor) {
      return channelA.minor - channelB.minor;
    }

    const patchA = channelA.patch ?? 0;
    const patchB = channelB.patch ?? 0;
    if (patchA !== patchB) {
      return patchA - patchB;
    }

    // Handle prerelease comparison
    const hasPreA = channelA.prerelease !== undefined;
    const hasPreB = channelB.prerelease !== undefined;

    // Version with prerelease is less than version without
    if (hasPreA && !hasPreB) {
      return -1;
    } else if (!hasPreA && hasPreB) {
      return 1;
    }

    // Both have prerelease -> compare beta numbers
    if (hasPreA && hasPreB) {
      const numA = channelA.prerelease!.number ?? 0;
      const numB = channelB.prerelease!.number ?? 0;
      if (numA !== numB) {
        return numA - numB;
      }
    }
  }

  return 0;
}
