import { logger } from '../../logger';
import { Upgrade } from '../common';

/*
 * The updateDependency() function is mandatory, and is used for updating one dependency at a time.
 * It returns the currentFileContent if no changes are necessary (e.g. because the existing branch/PR is up to date),
 * or with new content if changes are necessary.
 */

export function updateDependency(
  currentFileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    const delimiter =
      currentFileContent.split('"').length >
      currentFileContent.split("'").length
        ? '"'
        : "'";
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    if (!lineToChange.includes(upgrade.depName)) {
      logger.debug('No gem match on line');
      return null;
    }
    const newValue = upgrade.newValue
      .split(',')
      .map(part => `, ${delimiter}${part.trim()}${delimiter}`)
      .join('');
    const newLine = lineToChange.replace(
      new RegExp(
        `(gem ${delimiter}[^${delimiter}]+${delimiter})(,\\s+${delimiter}[^${delimiter}]+${delimiter}){0,2}`
      ),
      `$1${newValue}`
    );
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
