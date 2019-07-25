import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(currentFileContent: string, upgrade: Upgrade) {
  try {
    logger.debug(`buildkite.updateDependency: ${upgrade.newValue}`);
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    const depLine = new RegExp(/^(\s+[^#]+#)[^:]+(:.*)$/);
    if (!lineToChange.match(depLine)) {
      logger.debug('No image line found');
      return null;
    }
    const newLine = lineToChange.replace(depLine, `$1${upgrade.newValue}$2`);
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new buildkite version');
    return null;
  }
}
