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
    'Checking if we should bump project version'
  );
  let bumpedContent = content;

  if (!currentValue) {
    logger.warn('Unable to bump project version, project has no version');
    return { bumpedContent };
  }

  if (!semver.valid(currentValue)) {
    logger.warn(
      { currentValue },
      'Unable to bump project version, not a valid semver'
    );
    return { bumpedContent };
  }

  try {
    const project = new XmlDocument(content);
    const versionNode = project.descendantWithPath('PropertyGroup.Version')!;
    const startTagPosition = versionNode.startTagPosition;
    const versionPosition = content.indexOf(versionNode.val, startTagPosition);

    const newProjVersion = semver.inc(currentValue, bumpVersion as ReleaseType);
    if (!newProjVersion) {
      throw new Error('semver inc failed');
    }

    logger.debug({ newProjVersion });
    bumpedContent = replaceAt(
      content,
      versionPosition,
      currentValue,
      newProjVersion
    );

    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('project version bumped');
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
