import { logger } from '../../logger';
import { Upgrade } from '../common';
import { parseLine } from './extract';

function lineContainsDep(line, dep) {
  const { depName } = parseLine(line);
  return dep === depName;
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  const { currentValue, newValue } = upgrade;
  logger.debug(`cocoapods.updateDependency: ${newValue}`);

  const lines = fileContent.split('\n');
  const lineToChange = lines[upgrade.managerData.lineNumber];

  if (!lineContainsDep(lineToChange, upgrade.depName)) return null;

  const regex = new RegExp(`(['"])${currentValue.replace('.', '\\.')}\\1`);
  const newLine = lineToChange.replace(regex, `$1${newValue}$1`);

  if (newLine === lineToChange) {
    logger.debug('No changes necessary');
    return fileContent;
  }

  lines[upgrade.managerData.lineNumber] = newLine;
  return lines.join('\n');
}
