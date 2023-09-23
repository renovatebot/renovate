import semver, { ReleaseType } from 'semver';
import { logger } from '../../../logger';
import { newlineRegex, regEx } from '../../../util/regex';
import type {
  BumpPackageVersionResult,
  UpdateDependencyConfig,
} from '../types';
import type { SbtManagerData } from './types';

export function bumpPackageVersion(
  content: string,
  currentValue: string,
  bumpVersion: ReleaseType
): BumpPackageVersionResult {
  logger.debug(
    { bumpVersion, currentValue },
    'Checking if we should bump build.sbt version'
  );
  let bumpedContent = content;
  const bumpedVersion = semver.inc(currentValue, bumpVersion);
  if (!bumpedVersion) {
    logger.warn('Version incremental failed');
    return { bumpedContent };
  }
  bumpedContent = content.replace(
    regEx(/^(version\s*:=\s*).*$/m),
    `$1"${bumpedVersion}"`
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
}: UpdateDependencyConfig<SbtManagerData>): string | null {
  const { managerData, currentValue, newValue } = upgrade;
  if (currentValue && newValue) {
    if (managerData?.lineNumber) {
      const lineIndex = managerData.lineNumber - 1;
      const offset = fileContent
        .split(newlineRegex, lineIndex)
        .join('\n').length;
      const offsetEndOfLine = fileContent
        .split(newlineRegex, lineIndex + 1)
        .join('\n').length;

      const [header, updateLine, footer] = [
        fileContent.slice(0, offset),
        fileContent.slice(offset, offsetEndOfLine),
        fileContent.slice(offsetEndOfLine),
      ];

      const updatedLine = updateLine.replace(currentValue, newValue);
      return header + updatedLine + footer;
    }
    return fileContent.replace(currentValue, newValue);
  }

  return null;
}
