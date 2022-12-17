import semver, { ReleaseType } from 'semver';
import { logger } from '../../../../../logger';
import { regEx } from '../../../../../util/regex';
import type { BumpPackageVersionResult } from '../../../types';

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
      const mirrorPackage = bumpVersion.replace('mirror:', '');
      const parsedContent = JSON.parse(content);
      newPjVersion =
        parsedContent.dependencies?.[mirrorPackage] ??
        parsedContent.devDependencies?.[mirrorPackage] ??
        parsedContent.optionalDependencies?.[mirrorPackage] ??
        parsedContent.peerDependencies?.[mirrorPackage];
      if (!newPjVersion) {
        logger.warn('bumpVersion mirror package not found: ' + mirrorPackage);
        return { bumpedContent };
      }
    } else {
      newPjVersion = semver.inc(currentValue, bumpVersion as ReleaseType);
    }
    // TODO: fix types (#7154)
    logger.debug(`newPjVersion: ${newPjVersion!}`);
    bumpedContent = content.replace(
      regEx(`(?<version>"version":\\s*")[^"]*`),
      `$<version>${newPjVersion!}`
    );
    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('Bumped package.json version');
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
