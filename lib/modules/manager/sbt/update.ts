import type { ReleaseType } from 'semver';
import semver from 'semver';
import { logger } from '../../../logger';
import { escapeRegExp, regEx } from '../../../util/regex';
import type {
  BumpPackageVersionResult,
  UpdateDependencyConfig,
} from '../types';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType,
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump build.sbt version',
  );
  logger.warn({ content }, 'bumpPackageVersion content');
  let bumpedContent = content;
  const bumpedVersion = semver.inc(currentValue, bumpVersion);
  if (!bumpedVersion) {
    logger.warn('Version incremental failed');
    return { bumpedContent };
  }
  bumpedContent = content.replace(
    regEx(/^(version\s*:=\s*).*$/m),
    `$1"${bumpedVersion}"`,
  );

  if (bumpedContent === content) {
    logger.debug('Version was already bumped');
  } else {
    logger.debug(`Bumped build.sbt version to ${bumpedVersion}`);
  }

  return { bumpedContent };
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depName, newName, currentValue, newValue, sharedVariableName } =
    upgrade;

  let updatedContent = fileContent;

  const [groupId, artifactId] = depName!.split(':', 2);

  // Update the version
  if (newValue && currentValue && newValue !== currentValue) {
    if (sharedVariableName) {
      logger.debug(
        { depName, sharedVariableName, currentValue, newValue },
        'Updating version in shared variable for sbt dependency',
      );

      const patternSharedVariable = new RegExp(
        `${escapeRegExp(sharedVariableName)}(\\s*:\\s*String)?\\s*=\\s*"${currentValue}"`,
        'g',
      );

      updatedContent = updatedContent.replace(
        patternSharedVariable,
        (match, typed) => {
          return `${sharedVariableName}${typed ?? ''} = "${newValue}"`;
        },
      );
    } else {
      logger.debug(
        { depName, currentValue, newValue },
        'Updating version for sbt dependency',
      );

      const pattern = new RegExp(
        `"${escapeRegExp(groupId)}"\\s*(%|%%|%%%)\\s*"${escapeRegExp(artifactId)}"\\s*%\\s*"${escapeRegExp(currentValue)}"`,
        'g',
      );

      updatedContent = updatedContent.replace(
        pattern,
        (match, percentSigns) => {
          return `"${groupId}" ${percentSigns} "${artifactId}" % "${newValue}"`;
        },
      );
    }
  }

  // Update the dependency/artifact groupId/artifactId in case of replacement
  if (upgrade.updateType === 'replacement' && newName) {
    logger.debug(
      { depName, newName, currentValue, newValue },
      'Applying replacement update for sbt dependency',
    );

    const [newGroupId, newArtifactId] = newName.split(':', 2);

    const pattern = new RegExp(
      `"${escapeRegExp(groupId)}"\\s*(%|%%|%%%)\\s*"${escapeRegExp(artifactId)}"`,
      'g',
    );

    updatedContent = updatedContent.replace(pattern, (match, percentSigns) => {
      return `"${newGroupId}" ${percentSigns} "${newArtifactId}"`;
    });
  }

  return updatedContent;
}
