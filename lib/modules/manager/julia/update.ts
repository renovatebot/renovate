import type { ReleaseType } from 'semver';
import semver from 'semver';
import { logger } from '../../../logger/index.ts';
import { regEx } from '../../../util/regex.ts';
import type { BumpPackageVersionResult } from '../types.ts';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType,
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump Julia project version',
  );
  let bumpedContent = content;

  if (!semver.valid(currentValue)) {
    logger.warn(
      { currentValue },
      'Unable to bump Julia project version, not a valid semver',
    );
    return { bumpedContent };
  }

  try {
    const newProjectVersion = semver.inc(currentValue, bumpVersion);
    if (!newProjectVersion) {
      throw new Error('semver inc failed');
    }

    logger.debug({ newProjectVersion });

    // TOML puts top-level keys before any table, so the first `version` at
    // the start of a line is the project's.
    bumpedContent = content.replace(
      regEx(`^(?<version>version[ \\t]*=[ \\t]*['"])[^'"]*`, 'm'),
      `$<version>${newProjectVersion}`,
    );

    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('Bumped Julia project version');
    }
  } catch {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion',
    );
  }

  return { bumpedContent };
}
