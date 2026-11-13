import { isNonEmptyString, isNumericString } from '@sindresorhus/is';
import upath from 'upath';
import { logger } from '../../../../logger/index.ts';
import { coerceArray } from '../../../../util/array.ts';
import { coerceObject } from '../../../../util/object.ts';
import { UtcDate } from '../../../../util/schema-utils/index.ts';
import { coerceString } from '../../../../util/string.ts';
import { NpmDatasource } from '../../../datasource/npm/index.ts';
import type { NpmrcPackageFile } from '../../types.ts';
import { NpmrcCooldown as NpmrcCooldownSchema } from '../schema.ts';
import type { NpmManagerData } from '../types.ts';
import type { NpmrcCooldown } from './types.ts';

interface NpmrcLockFileConfig {
  managerData?: NpmManagerData;
  packageFile?: string;
}

function parseNpmrcDays(value: string, lenient: boolean): number {
  if (lenient) {
    return parseInt(value, 10);
  }
  // npm reads the setting as a number, and ignores values like `7d`
  return isNumericString(value) ? parseFloat(value) : Number.NaN;
}

/**
 * Parses the `before` or `min-release-age` setting of an `.npmrc`, preferring a valid `before`. With `lenient`, a `min-release-age` which starts with a whole number, like `7d`, counts as that number of days.
 */
export function parseNpmrcCooldown(
  npmrcContent: string | null | undefined,
  lenient = false,
): NpmrcCooldown | null {
  if (!npmrcContent) {
    return null;
  }

  const parsed = NpmrcCooldownSchema.parse(npmrcContent);

  const before = parsed.before;
  if (isNonEmptyString(before)) {
    const date = UtcDate.safeParse(before);
    if (date.success) {
      return { source: 'before', date: date.data };
    }
    logger.debug(`Invalid before date in .npmrc: ${before}, ignoring`);
  }

  const minReleaseAge = parsed['min-release-age'];
  if (isNonEmptyString(minReleaseAge)) {
    const days = parseNpmrcDays(minReleaseAge, lenient);
    if (Number.isFinite(days) && days >= 0) {
      return { source: 'min-release-age', days };
    }
    logger.debug(
      `Invalid min-release-age in .npmrc: ${minReleaseAge}, ignoring`,
    );
  }

  return null;
}

/**
 * The minimum release age set by the `before` or `min-release-age` setting of an `.npmrc`, as a duration or as the ISO 8601 date of `before`.
 */
export function getNpmrcMinimumReleaseAge(
  npmrcContent: string | null | undefined,
): string | undefined {
  const cooldown = parseNpmrcCooldown(npmrcContent);
  if (cooldown?.source === 'min-release-age') {
    return `${cooldown.days} days`;
  }
  // the date is kept as is, as the extract result is cached and the age grows
  // over time
  return cooldown?.date.toISO();
}

/**
 * Whether npm reads the `.npmrc` of the package file when it generates the lock file, which is the case for the `npmrc` option and for an `.npmrc` next to the lock file, or next to the package file without a lock file.
 */
export function isNpmrcOfLockFile({
  managerData,
  packageFile,
}: NpmrcLockFileConfig): boolean {
  const { npmLock, npmrcFileName } = coerceObject(managerData);
  if (!npmrcFileName) {
    return true;
  }
  const lockFileDir = upath.dirname(coerceString(npmLock ?? packageFile));
  return npmrcFileName === upath.join(lockFileDir, '.npmrc');
}

/**
 * Adds a `packageRules` entry with the minimum release age of the merged `.npmrc` (the `npmrc` option and the repository `.npmrc`, as used by npm at post-update) to the package files which are not managed by Yarn or pnpm.
 */
export function setNpmrcMinimumReleaseAge(
  packageFiles: Partial<NpmrcPackageFile<NpmManagerData>>[],
): void {
  const npmPackageFiles = packageFiles.filter(
    ({ managerData }) => !managerData?.yarnLock && !managerData?.pnpmLockFile,
  );
  for (const packageFile of npmPackageFiles) {
    const { managerData } = packageFile;
    const minimumReleaseAge = getNpmrcMinimumReleaseAge(packageFile.npmrc);
    if (minimumReleaseAge && !isNpmrcOfLockFile(packageFile)) {
      logger.debug(
        `Ignoring the minimum release age in the .npmrc ${managerData?.npmrcFileName} for ${packageFile.packageFile}, as it is not next to the lock file`,
      );
      continue;
    }
    if (minimumReleaseAge) {
      logger.debug(
        `Found minimum release age ${minimumReleaseAge} in the .npmrc ${managerData?.npmrcFileName ?? '(config)'} for ${packageFile.packageFile}`,
      );
      packageFile.packageRules = [
        ...coerceArray(packageFile.packageRules),
        {
          matchDatasources: [NpmDatasource.id],
          minimumReleaseAgeExtracted: minimumReleaseAge,
        },
      ];
    }
  }
}
