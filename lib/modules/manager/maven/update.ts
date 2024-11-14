import is from '@sindresorhus/is';
import type { ReleaseType } from 'semver';
import semver from 'semver';
import { XmlDocument } from 'xmldoc';
import { logger } from '../../../logger';
import { replaceAt } from '../../../util/string';
import type {
  BumpPackageVersionResult,
  UpdateDependencyConfig,
  Upgrade,
} from '../types';

export function updateAtPosition(
  fileContent: string,
  upgrade: Upgrade,
  endingAnchor: string,
): string | null {
  const { depName, newName, currentValue, newValue, fileReplacePosition } =
    upgrade;
  let leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const versionClosePosition = rightPart.indexOf(endingAnchor);
  let restPart = rightPart.slice(versionClosePosition);
  const versionPart = rightPart.slice(0, versionClosePosition);
  const version = versionPart.trim();
  if (newName) {
    const blockStart = Math.max(
      leftPart.lastIndexOf('<parent'),
      leftPart.lastIndexOf('<dependency'),
      leftPart.lastIndexOf('<plugin'),
      leftPart.lastIndexOf('<extension'),
    );
    let leftBlock = leftPart.slice(blockStart);
    const blockEnd = Math.min(
      restPart.indexOf('</parent'),
      restPart.indexOf('</dependency'),
      restPart.indexOf('</plugin'),
      restPart.indexOf('</extension'),
    );
    let rightBlock = restPart.slice(0, blockEnd);
    const [groupId, artifactId] = depName!.split(':', 2);
    const [newGroupId, newArtifactId] = newName.split(':', 2);
    if (leftBlock.indexOf('<groupId') > 0) {
      leftBlock = updateValue(leftBlock, 'groupId', groupId, newGroupId);
    } else {
      rightBlock = updateValue(rightBlock, 'groupId', groupId, newGroupId);
    }
    if (leftBlock.indexOf('<artifactId') > 0) {
      leftBlock = updateValue(
        leftBlock,
        'artifactId',
        artifactId,
        newArtifactId,
      );
    } else {
      rightBlock = updateValue(
        rightBlock,
        'artifactId',
        artifactId,
        newArtifactId,
      );
    }
    leftPart = leftPart.slice(0, blockStart) + leftBlock;
    restPart = rightBlock + restPart.slice(blockEnd);
  } else if (version === newValue) {
    return fileContent;
  }
  if (version === currentValue || upgrade.groupName) {
    // TODO: validate newValue (#22198)
    const replacedPart = versionPart.replace(version, newValue!);
    return leftPart + replacedPart + restPart;
  }
  logger.debug({ depName, version, currentValue, newValue }, 'Unknown value');
  return null;
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const offset = fileContent.indexOf('<');
  const spaces = fileContent.slice(0, offset);
  const restContent = fileContent.slice(offset);
  const updatedContent = updateAtPosition(restContent, upgrade, '</');
  if (!updatedContent) {
    return null;
  }
  if (updatedContent === restContent) {
    return fileContent;
  }
  return `${spaces}${updatedContent}`;
}

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType,
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump pom.xml version',
  );
  let bumpedContent = content;

  if (!semver.valid(currentValue)) {
    logger.warn(
      { currentValue },
      'Unable to bump pom.xml version, not a valid semver',
    );
    return { bumpedContent };
  }

  try {
    const project = new XmlDocument(content);
    const versionNode = project.childNamed('version')!;
    const startTagPosition = versionNode.startTagPosition;
    const versionPosition = content.indexOf(versionNode.val, startTagPosition);

    let newPomVersion: string | null = null;
    const currentPrereleaseValue = semver.prerelease(currentValue);
    if (isSnapshot(currentPrereleaseValue)) {
      // It is already a SNAPSHOT version.
      // Therefore the same qualifier (prerelease) will be used as before.
      let releaseType = bumpVersion;
      if (!bumpVersion.startsWith('pre')) {
        releaseType = `pre${bumpVersion}` as ReleaseType;
      }
      newPomVersion = semver.inc(
        currentValue,
        releaseType,
        currentPrereleaseValue!.join('.'),
        false,
      );
    } else if (currentPrereleaseValue) {
      // Some qualifier which is not a SNAPSHOT is present.
      // The expected behaviour in this case is unclear and the standard increase will be used.
      newPomVersion = semver.inc(currentValue, bumpVersion);
    } else {
      // A release version without any qualifier is present.
      // Therefore the SNAPSHOT qualifier will be added if a prerelease is requested.
      // This will do a normal increment, ignoring SNAPSHOT, if a non-prerelease bumpVersion is configured
      newPomVersion = semver.inc(currentValue, bumpVersion, 'SNAPSHOT', false);
    }
    if (!newPomVersion) {
      throw new Error('semver inc failed');
    }

    logger.debug({ newPomVersion });
    bumpedContent = replaceAt(
      content,
      versionPosition,
      currentValue,
      newPomVersion,
    );

    if (bumpedContent === content) {
      logger.debug('Version was already bumped');
    } else {
      logger.debug('pom.xml version bumped');
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

function isSnapshot(
  prerelease: ReadonlyArray<string | number> | null,
): boolean {
  const lastPart = prerelease?.at(-1);
  return is.string(lastPart) && lastPart.endsWith('SNAPSHOT');
}

function updateValue(
  content: string,
  nodeName: string,
  oldValue: string,
  newValue: string,
): string {
  const elementStart = content.indexOf('<' + nodeName);
  const start = content.slice(elementStart).indexOf('>') + elementStart + 1;
  const end = content.slice(start).indexOf('</' + nodeName) + start;
  const elementContent = content.slice(start, end);
  if (elementContent.trim() === oldValue) {
    return (
      content.slice(0, start) +
      elementContent.replace(oldValue, newValue) +
      content.slice(end)
    );
  }
  logger.debug({ content, nodeName, oldValue, newValue }, 'Unknown value');
  return content;
}
