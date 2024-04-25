import semver, { ReleaseType } from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { replaceAt } from '../../../util/string';
import type { BumpPackageVersionResult } from '../types';
import { findVersion } from './util';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType,
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump project version',
  );
  let bumpedContent = content;

  if (!semver.valid(currentValue)) {
    logger.warn(
      { currentValue },
      'Unable to bump project version, not a valid semver',
    );
    return { bumpedContent };
  }

  try {
    const project = new XmlDocument(content);
    const versionNode = findVersion(project);
    if (!versionNode) {
      logger.warn(
        "Couldn't find Version or VersionPrefix in any PropertyGroup",
      );
      return { bumpedContent };
    }

    const currentProjVersion = versionNode.val;
    if (currentProjVersion !== currentValue) {
      logger.warn(
        { currentValue, currentProjVersion },
        "currentValue passed to bumpPackageVersion() doesn't match value found",
      );
      return { bumpedContent };
    }

    const startTagPosition = versionNode.startTagPosition;
    const versionPosition = content.indexOf(
      currentProjVersion,
      startTagPosition,
    );

    const newProjVersion = semver.inc(currentValue, bumpVersion);
    if (!newProjVersion) {
      throw new Error('semver inc failed');
    }

    logger.debug(`newProjVersion: ${newProjVersion}`);
    bumpedContent = replaceAt(
      content,
      versionPosition,
      currentValue,
      newProjVersion,
    );
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
