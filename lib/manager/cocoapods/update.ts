import { logger } from '../../logger';
import { Upgrade } from '../common';
import { parseLine } from './extract';

function lineContainsDep(line: string, dep: string): boolean {
  const { depName } = parseLine(line);
  return dep === depName;
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  const { currentValue, managerData, depName, newValue } = upgrade;

  // istanbul ignore if
  if (!currentValue || !managerData || !depName) {
    logger.warn('Cocoapods: invalid upgrade object');
    return null;
  }

  logger.debug(`cocoapods.updateDependency: ${newValue}`);

  const lines = fileContent.split('\n');
  const lineToChange = lines[managerData.lineNumber];

  if (!lineContainsDep(lineToChange, depName)) return null;

  const regex = new RegExp(`(['"])${currentValue.replace('.', '\\.')}\\1`);
  const newLine = lineToChange.replace(regex, `$1${newValue}$1`);

  if (newLine === lineToChange) {
    logger.debug('No changes necessary');
    return fileContent;
  }

  lines[managerData.lineNumber] = newLine;
  return lines.join('\n');
}
