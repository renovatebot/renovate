import { logger } from '../../logger';
import { Upgrade } from '../common';
import rubySemver from '../../versioning/ruby';

/*
 * The updateDependency() function is mandatory, and is used for updating one dependency at a time.
 * It returns the currentFileContent if no changes are necessary (e.g. because the existing branch/PR is up to date),
 * or with new content if changes are necessary.
 */

function getStable(version: string): string | null {
  const major = rubySemver.getMajor(version);
  const minor = rubySemver.getMinor(version);
  const patch = rubySemver.getPatch(version);
  return [major, minor, patch].filter(x => x !== null).join('.') || null;
}

const rangeRegex = /^\s*(=|~>)\s*(?<rangeContent>\S.*\S)\s*$/;

function getSingleVersion(version: string): string | null {
  const rangeMatch = version.match(rangeRegex);
  if (rangeMatch) {
    const { rangeContent } = rangeMatch.groups;
    if (rubySemver.isSingleVersion(rangeContent)) {
      return rangeContent;
    }
  }
  if (rubySemver.isSingleVersion(version)) {
    return version;
  }
  return null;
}

const gemLineRegex = /^(?<gemPart>\s*gem\s+(?<delimiter>['"])(?<gemName>[^'"]+)\k<delimiter>)(?<versionPart>(\s*,\s*(['"])[^'"]+\6)*)(?<argsPart>\s*,\s*.+?)?(?<whitespacePart>\s*(#.*)?)$/;
const versionPartRegex = /^(?<versionPartPrefix>\s*,\s*)(?<versionPartContent>.*)$/;
const tagRegex = /\s*,\s*(:tag\s*=>|tag:)\s*(['"])(?<tag>[^'"]+)\2/;

function updateLine(line: string, upgrade: Upgrade): string | null {
  const { newValue, depName, depType } = upgrade;
  const isGitTag = depType === 'tags';
  const gemLineMatch = line.match(gemLineRegex);
  if (gemLineMatch) {
    const {
      gemPart,
      gemName,
      delimiter,
      versionPart,
      argsPart = '',
      whitespacePart,
    } = gemLineMatch.groups;
    if (gemName !== depName) return null;

    const { versionPartPrefix, versionPartContent } = versionPart.match(
      versionPartRegex
    ).groups;

    let newArgsPart = argsPart;
    const tagMatch = argsPart.match(tagRegex);
    if (tagMatch) {
      const tagPart = tagMatch[0];
      const [leftPart, rightPart] = argsPart.split(tagPart);
      const { tag } = tagMatch.groups;
      newArgsPart = `${leftPart}${tagPart.replace(tag, newValue)}${rightPart}`;
    }

    let newVersionPartContent = versionPartContent;
    if (isGitTag) {
      const gemVersion = versionPartContent.replace(/['"]/g, '').trim();
      const singleVersion = getSingleVersion(gemVersion);
      if (singleVersion) {
        const stable = getStable(newValue);
        if (stable)
          newVersionPartContent = versionPartContent.replace(
            singleVersion,
            stable
          );
      }
    } else {
      newVersionPartContent = newValue
        .split(/\s*,\s*/)
        .map(part => `${delimiter}${part}${delimiter}`)
        .join(', ');
    }

    return `${gemPart}${versionPartPrefix}${newVersionPartContent}${newArgsPart}${whitespacePart}`;
  }
  return null;
}

export function updateDependency(
  currentFileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    const newLine = updateLine(lineToChange, upgrade);
    if (newLine === null) {
      logger.debug('No gem match on line');
      return null;
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Gemfile value');
    return null;
  }
}
