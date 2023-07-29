import semver, { ReleaseType } from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { replaceAt } from '../../../util/string';
import type { BumpPackageVersionResult } from '../types';
import { findVersion } from './extract';

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
    const versionNode = findVersion(project);
    if (!versionNode) {
      logger.warn(
        "Couldn't find Version or VersionPrefix in any PropertyGroup"
      );
      return { bumpedContent };
    }

    const currentProjVersion = versionNode.val;
    if (currentProjVersion !== currentValue) {
      throw new Error(
        `currentValue passed to bumpPackageVersion() doesn't match value found`
      );
    }

    const startTagPosition = versionNode.startTagPosition;
    const versionPosition = content.indexOf(
      currentProjVersion,
      startTagPosition
    );

    const newProjVersion = semver.inc(currentValue, bumpVersion as ReleaseType);
    if (!newProjVersion) {
      throw new Error('semver inc failed');
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
