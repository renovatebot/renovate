import semver, { ReleaseType } from 'semver';
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
  const { depName, currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const versionClosePosition = rightPart.indexOf(endingAnchor);
  const restPart = rightPart.slice(versionClosePosition);
  const versionPart = rightPart.slice(0, versionClosePosition);
  const version = versionPart.trim();
  if (version === newValue) {
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
  if (upgrade.updateType === 'replacement') {
    logger.warn('maven manager does not support replacement updates yet');
    return null;
  }
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

    const newPomVersion = semver.inc(currentValue, bumpVersion);
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
