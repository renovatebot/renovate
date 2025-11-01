import type { ReleaseType } from 'semver';
import semver from 'semver';
import { logger } from '../../../logger';
import { escapeRegExp, regEx } from '../../../util/regex';
import { doAutoReplace } from '../../../workers/repository/update/branch/auto-replace';
import type { BranchUpgradeConfig } from '../../../workers/types';
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

export async function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): Promise<string | null> {
  const { depName, newName } = upgrade;

  let updatedContent = fileContent;

  if (upgrade.updateType === 'replacement') {
    if (newName) {
      const [oldGroupId, oldArtifactId] = depName!.split(':', 2);
      const [newGroupId, newArtifactId] = newName.split(':', 2);
      const pattern = new RegExp(
        `"${escapeRegExp(oldGroupId)}"\\s*(%%?)\\s*"${escapeRegExp(oldArtifactId)}"`,
        'g',
      );

      updatedContent = fileContent.replace(pattern, (match, percentSigns) => {
        return `"${newGroupId}" ${percentSigns} "${newArtifactId}"`;
      });
    }
  }

  if (newName) {
    // Replace the depName so that doAutoReplace works with the new name that has been updated above
    return await doAutoReplace(
      { ...upgrade, depName: newName } as BranchUpgradeConfig,
      updatedContent,
      false,
      true,
    );
  } else {
    return await doAutoReplace(
      upgrade as BranchUpgradeConfig,
      updatedContent,
      false,
      true,
    );
  }
}
