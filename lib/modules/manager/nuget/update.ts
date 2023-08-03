import semver, { ReleaseType } from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { replaceAt } from '../../../util/string';
import type { BumpPackageVersionResult } from '../types';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump project version'
  );
  let bumpedContent = content;

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
    const currentProjVersion = versionNode.val;
    const startTagPosition = versionNode.startTagPosition;
    const versionPosition = content.indexOf(
      currentProjVersion,
      startTagPosition
    );

    const newProjVersion = semver.inc(currentValue, bumpVersion);
    if (!newProjVersion) {
      throw new Error('semver inc failed');
    }

    if (currentProjVersion === newProjVersion) {
      logger.debug('Version was already bumped');
      return { bumpedContent };
    }

    logger.debug(`newProjVersion: ${newProjVersion}`);
    bumpedContent = replaceAt(
      content,
      versionPosition,
      currentValue,
      newProjVersion
    );
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
