import { dump, load } from 'js-yaml';
import semver, { ReleaseType } from 'semver';
import { logger } from '../../../logger';
import type { BumpPackageVersionResult } from '../types';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType | string
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump package.json version'
  );
  // TODO: types (#7154)
  let newPjVersion: string | null;
  let bumpedContent = content;
  try {
    if (bumpVersion.startsWith('mirror:')) {
      logger.warn('not support bumpVersion mirror package: ' + bumpVersion);
      return { bumpedContent };
    } else {
      newPjVersion = semver.inc(currentValue, bumpVersion as ReleaseType);
    }
    // TODO: fix types (#7154)
    logger.debug(`newPjVersion: ${newPjVersion!}`);

    try {
      const parsedContent: any = load(bumpedContent);
      if (parsedContent.metadata.version === newPjVersion) {
        logger.debug('Version was already bumped');
      } else {
        logger.debug('Bumped version');
        parsedContent.metadata.version = newPjVersion;
        bumpedContent = dump(parsedContent);
      }
    } catch (err) {
      logger.error(err, 'Failed to parse OAM version definition.');
    }
  } catch (err) {
    logger.warn(
      {
        content,
        currentValue,
        bumpVersion,
      },
      'Failed to bumpVersion'
    );
  }
  return { bumpedContent };
}
