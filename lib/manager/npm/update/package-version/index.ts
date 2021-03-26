import { ReleaseType, inc } from 'semver';
import { logger } from '../../../../logger';
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
  let newPjVersion: string;
  let bumpedContent = content;
  try {
    if (bumpVersion.startsWith('mirror:')) {
      const mirrorPackage = bumpVersion.replace('mirror:', '');
      const parsedContent = JSON.parse(content);
      newPjVersion =
        (parsedContent.dependencies || {})[mirrorPackage] ||
        (parsedContent.devDependencies || {})[mirrorPackage] ||
        (parsedContent.optionalDependencies || {})[mirrorPackage] ||
        (parsedContent.peerDependencies || {})[mirrorPackage];
      if (!newPjVersion) {
        logger.warn('bumpVersion mirror package not found: ' + mirrorPackage);
        return { bumpedContent };
      }
    } else {
      newPjVersion = inc(currentValue, bumpVersion as ReleaseType);
    }
    logger.debug({ newPjVersion });
    bumpedContent = content.replace(
      /("version":\s*")[^"]*/,
      `$1${newPjVersion}`
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
