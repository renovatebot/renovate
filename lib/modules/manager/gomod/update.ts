// TODO: types (#22198)
import { logger } from '../../../logger/index.ts';
import { newlineRegex, regEx } from '../../../util/regex.ts';
import { isPseudoVersion } from '../../versioning/gomod/index.ts';
import type { UpdateDependencyConfig } from '../types.ts';
import {
  endBlockRegex,
  excludeBlockStartRegex,
  parseLine,
} from './line-parser.ts';
import type { GoModManagerData } from './types.ts';

function getNameWithNoVersion(name: string): string {
  // remove version suffixes like /v1 or /v2
  let nameNoVersion = name.replace(regEx(/\/v\d+$/), '');
  // gopkg.in is a special case where the major version is added with a dot rather than a slash
  if (nameNoVersion.startsWith('gopkg.in')) {
    nameNoVersion = nameNoVersion.replace(regEx(/\.v\d+$/), '');
  }
  return nameNoVersion;
}

function isRequireDirective(depType: string | undefined): boolean {
  return depType === 'require' || depType === 'indirect';
}

function hasSameDirectiveKind(
  depType: string | undefined,
  foundDepType: string | undefined,
): boolean {
  if (depType === foundDepType) {
    return true;
  }
  // A require line can be marked as indirect after `go mod tidy` changed the file
  return isRequireDirective(depType) && isRequireDirective(foundDepType);
}

function isDependencyLine(
  line: string,
  depName: string,
  depType: string | undefined,
  multiLine: boolean | undefined,
): boolean {
  const dep = parseLine(line);
  if (!dep) {
    return false;
  }
  if (!hasSameDirectiveKind(depType, dep.depType)) {
    return false;
  }
  const depMultiLine = dep.managerData?.multiLine ?? false;
  const expectedMultiLine = multiLine ?? false;
  if (depMultiLine !== expectedMultiLine) {
    return false;
  }
  return getNameWithNoVersion(dep.depName!) === getNameWithNoVersion(depName);
}

function findDependencyLine(
  lines: string[],
  depName: string,
  depType: string | undefined,
  multiLine: boolean | undefined,
): number | undefined {
  let inExcludeBlock = false;
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const line = lines[lineNumber];
    if (inExcludeBlock) {
      inExcludeBlock = !endBlockRegex.test(line);
      continue;
    }
    if (excludeBlockStartRegex.test(line)) {
      inExcludeBlock = true;
      continue;
    }
    if (isDependencyLine(line, depName, depType, multiLine)) {
      return lineNumber;
    }
  }
  return undefined;
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig<GoModManagerData>): string | null {
  try {
    logger.debug(`gomod.updateDependency: ${upgrade.newValue}`);
    const { depType, updateType } = upgrade;
    const currentName = upgrade.depName;
    if (updateType === 'replacement') {
      logger.warn('gomod manager does not support replacement updates yet');
      return null;
    }
    const recordedLineNumber = upgrade.managerData?.lineNumber;
    const multiLine = upgrade.managerData?.multiLine;
    /* v8 ignore next -- should never happen */
    if (!currentName || recordedLineNumber === undefined) {
      return null;
    }
    const currentNameNoVersion = getNameWithNoVersion(currentName);
    const lines = fileContent.split(newlineRegex);
    const recordedLine: string | undefined = lines[recordedLineNumber];
    // `go mod tidy` can shift lines, so fall back to searching the whole file
    const lineNumber =
      recordedLine !== undefined &&
      (recordedLine.includes(currentNameNoVersion) ||
        recordedLine.includes('rethinkdb/rethinkdb-go.v5'))
        ? recordedLineNumber
        : findDependencyLine(lines, currentName, depType, multiLine);
    if (lineNumber === undefined) {
      logger.debug(
        { depName: currentName, recordedLineNumber },
        'go.mod dependency line not found',
      );
      return null;
    }
    if (lineNumber !== recordedLineNumber) {
      logger.debug(
        {
          depName: currentName,
          lineNumber,
          recordedLineNumber,
        },
        'go.mod dependency line number changed',
      );
    }
    const lineToChange = lines[lineNumber];
    logger.trace({ upgrade, lineToChange }, 'go.mod current line');
    let updateLineExp: RegExp | undefined;

    if (depType === 'golang' || depType === 'toolchain') {
      updateLineExp = regEx(
        /(?<depPart>(?:toolchain )?go)(?<divider>\s*)(?:[^\s]+|[\w]+)/,
      );
    }
    if (depType === 'replace') {
      if (multiLine) {
        updateLineExp = regEx(
          /^(?<depPart>\s+[^\s]+[\s]+[=][>]+\s+)(?<divider>[^\s]+\s+)[^\s]+/,
        );
      } else {
        updateLineExp = regEx(
          /^(?<depPart>replace\s+[^\s]+[\s]+[=][>]+\s+)(?<divider>[^\s]+\s+)[^\s]+/,
        );
      }
    } else if (depType === 'require' || depType === 'indirect') {
      if (multiLine) {
        updateLineExp = regEx(/^(?<depPart>\s+[^\s]+)(?<divider>\s+)[^\s]+/);
      } else {
        updateLineExp = regEx(
          /^(?<depPart>require\s+[^\s]+)(?<divider>\s+)[^\s]+/,
        );
      }
    }
    if (updateLineExp && !updateLineExp.test(lineToChange)) {
      logger.debug('No line found to update');
      return null;
    }
    let newLine: string;
    if (upgrade.updateType === 'digest') {
      // Since the 2024 goproxy datasource changes, newValue and newDigest are
      // both extracted from the same proxy version string and always reference
      // the same commit, so newValue can be written directly for pseudo-versions.
      // However, for private modules (GONOPROXY / direct datasource), the proxy
      // has no data and newValue may equal currentValue. In that case, fall
      // through to the bare hash path so that gomodTidy can resolve it.
      if (
        isPseudoVersion(upgrade.newValue) &&
        upgrade.newValue !== upgrade.currentValue
      ) {
        logger.debug(
          { depName: currentName, lineToChange, newValue: upgrade.newValue },
          'gomod: updating pseudo-version digest',
        );
        newLine = lineToChange.replace(
          // TODO: can be undefined? (#22198)
          updateLineExp!,
          `$<depPart>$<divider>${upgrade.newValue}`,
        );
      } else {
        // Fallback for private modules where the proxy could not resolve a new
        // pseudo-version, or non-pseudo-version digest updates.
        // Writes the bare hash so that postUpdateOptions like gomodTidy can
        // normalize it into a valid pseudo-version via `go get`.
        const newDigestRightSized = upgrade.newDigest!.substring(
          0,
          upgrade.currentDigest!.length,
        );
        if (lineToChange.includes(newDigestRightSized)) {
          return fileContent;
        }
        logger.debug(
          { depName: currentName, lineToChange, newDigestRightSized },
          'gomod: need to update digest',
        );
        newLine = lineToChange.replace(
          // TODO: can be undefined? (#22198)
          updateLineExp!,
          `$<depPart>$<divider>${newDigestRightSized}`,
        );
      }
    } else {
      newLine = lineToChange.replace(
        // TODO: can be undefined? (#22198)
        updateLineExp!,
        `$<depPart>$<divider>${upgrade.newValue}`,
      );
    }
    if (upgrade.updateType === 'major') {
      logger.debug(`gomod: major update for ${currentName}`);
      if (currentName.startsWith('gopkg.in/')) {
        const oldV = currentName.split('.').pop();
        newLine = newLine.replace(`.${oldV}`, `.v${upgrade.newMajor}`);
        // Package renames - I couldn't think of a better place to do this
        newLine = newLine.replace(
          'gorethink/gorethink.v5',
          'rethinkdb/rethinkdb-go.v5',
        );
      } else if (
        upgrade.newMajor! > 1 &&
        !newLine.includes(`/v${upgrade.newMajor}`) &&
        !upgrade.newValue!.endsWith('+incompatible')
      ) {
        if (currentName === currentNameNoVersion) {
          // If package currently has no version, pin to latest one.
          newLine = newLine.replaceAll(
            currentName,
            `${currentName}/v${upgrade.newMajor}`,
          );
        } else {
          // Replace version
          const [oldV] = upgrade.currentValue!.split('.');
          newLine = newLine.replace(
            regEx(`/${oldV}(\\s+)`, undefined, false),
            `/v${upgrade.newMajor}$1`,
          );
        }
      }
    }
    if (
      lineToChange.endsWith('+incompatible') &&
      !upgrade.newValue?.endsWith('+incompatible')
    ) {
      let toAdd = '+incompatible';

      if (upgrade.updateType === 'major' && upgrade.newMajor! >= 2) {
        toAdd = '';
      }
      newLine += toAdd;
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }

    if (depType === 'indirect') {
      newLine = newLine.replace(
        regEx(/\s*(?:\/\/\s*indirect(?:\s*;)?\s*)*$/),
        ' // indirect',
      );
    }

    lines[lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.debug({ err }, 'Error setting new go.mod version');
    return null;
  }
}
