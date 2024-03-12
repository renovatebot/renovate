import semver, { ReleaseType } from 'semver';
import { logger } from '../../../../../logger';
import { regEx } from '../../../../../util/regex';
import type { BumpPackageVersionResult } from '../../../types';

type MirrorBumpVersion = `mirror:${string}`;

function isMirrorBumpVersion(
  bumpVersion: string,
): bumpVersion is MirrorBumpVersion {
  return bumpVersion.startsWith('mirror:');
}

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType | `mirror:${string}`,
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump package.json version',
  );
  // TODO: types (#22198)
  let newPjVersion: string | null;
  let bumpedContent = content;

  try {
    if (isMirrorBumpVersion(bumpVersion)) {
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
      newPjVersion = semver.inc(currentValue, bumpVersion);
    }
    // TODO: fix types (#22198)
    logger.debug(`newPjVersion: ${newPjVersion!}`);
    bumpedContent = content.replace(
      regEx(`(?<version>"version":\\s*")[^"]*`),
      `$<version>${newPjVersion!}`,
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
      'Failed to bumpVersion',
    );
  }
  return { bumpedContent };
}
