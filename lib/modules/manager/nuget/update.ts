import semver, { ReleaseType } from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { replaceAt } from '../../../util/string';
import type { BumpPackageVersionResult } from '../types';

export function bumpPackageVersion(
  content: string,
  currentValue: string | undefined,
  bumpVersion: ReleaseType | string
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump csproj version'
  );
  let bumpedContent = content;

  if (!currentValue) {
    logger.warn('Unable to bump csproj version, csproj has no version');
    return { bumpedContent };
  }

  if (!semver.valid(currentValue)) {
    logger.warn(
      { currentValue },
      'Unable to bump csproj version, not a valid semver'
    );
    return { bumpedContent };
  }

  try {
    const project = new XmlDocument(content);
    const versionNode = project.descendantWithPath('PropertyGroup.Version')!;
    const startTagPosition = versionNode.startTagPosition;
    const versionPosition = content.indexOf(versionNode.val, startTagPosition);

    const newCsprojVersion = semver.inc(
      currentValue,
      bumpVersion as ReleaseType
    );
    if (!newCsprojVersion) {
      throw new Error('semver inc failed');
    }

    logger.debug({ newCsprojVersion });
    bumpedContent = replaceAt(
      content,
      versionPosition,
      currentValue,
      newCsprojVersion
    );

    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('csproj version bumped');
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
