import { isNonEmptyString, isNumber } from '@sindresorhus/is';
import ini from 'ini';
import { DateTime } from 'luxon';
import { logger } from '../../../../logger/index.ts';
import type { PackageFile } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import type { NpmrcCooldown } from './types.ts';

/**
 * Parses the `before` or `min-release-age` setting of an `.npmrc`, preferring a valid `before`.
 */
export function parseNpmrcCooldown(
  npmrcContent: string | null | undefined,
): NpmrcCooldown | null {
  if (!npmrcContent) {
    return null;
  }

  const parsed = ini.parse(npmrcContent);

  const before = parsed.before;
  if (isNonEmptyString(before)) {
    const date = DateTime.fromISO(before, { zone: 'utc' });
    if (date.isValid) {
      return { source: 'before', date };
    }
    logger.debug(`Invalid before date in .npmrc: ${before}, ignoring`);
  }

  const minReleaseAge = parsed['min-release-age'];
  if (isNonEmptyString(minReleaseAge)) {
    const days = parseInt(minReleaseAge, 10);
    if (isNumber(days) && days >= 0) {
      return { source: 'min-release-age', days };
    }
    logger.debug(
      `Invalid min-release-age in .npmrc: ${minReleaseAge}, ignoring`,
    );
  }

  return null;
}

/**
 * Parses the `minimum-release-age` setting of an `.npmrc`, in minutes, which pnpm reads before v11.
 */
export function parseNpmrcPnpmMinimumReleaseAge(
  npmrcContent: string | null | undefined,
): number | undefined {
  if (!npmrcContent) {
    return undefined;
  }
  const minimumReleaseAge = ini.parse(npmrcContent)['minimum-release-age'];
  if (!isNonEmptyString(minimumReleaseAge)) {
    return undefined;
  }
  const minutes = parseInt(minimumReleaseAge, 10);
  if (isNumber(minutes) && minutes >= 0) {
    return minutes;
  }
  logger.debug(
    `Invalid minimum-release-age in .npmrc: ${minimumReleaseAge}, ignoring`,
  );
  return undefined;
}

/**
 * The minimum release age set by the `before` or `min-release-age` setting of an `.npmrc`, as a duration.
 *
 * A `before` date counts as the time elapsed since that date.
 */
export function getNpmrcMinimumReleaseAge(
  npmrcContent: string | null | undefined,
): string | undefined {
  const cooldown = parseNpmrcCooldown(npmrcContent);
  if (cooldown?.source === 'min-release-age') {
    return `${cooldown.days} days`;
  }
  if (cooldown?.source !== 'before') {
    return undefined;
  }

  const ageMs = Math.floor(-cooldown.date.diffNow().as('milliseconds'));
  return ageMs > 0 ? `${ageMs} milliseconds` : undefined;
}

/**
 * Sets `minimumReleaseAgeExtracted` from the repository `.npmrc` on the package files which are not managed by Yarn or pnpm.
 */
export function setNpmrcMinimumReleaseAge(
  packageFiles: Partial<PackageFile<NpmManagerData>>[],
): void {
  for (const packageFile of packageFiles) {
    const { managerData } = packageFile;
    if (managerData?.yarnLock || managerData?.pnpmLockFile) {
      continue;
    }
    const minimumReleaseAge = getNpmrcMinimumReleaseAge(
      managerData?.repoNpmrc?.content,
    );
    if (minimumReleaseAge) {
      logger.debug(
        `Found minimum release age ${minimumReleaseAge} in ${managerData!.repoNpmrc!.fileName} for ${packageFile.packageFile}`,
      );
      packageFile.minimumReleaseAgeExtracted = minimumReleaseAge;
    }
  }
}
