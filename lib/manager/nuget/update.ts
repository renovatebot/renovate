import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    logger.debug(`nuget.updateDependency(): ${upgrade.newFrom}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    const regex = /(Version\s*=\s*"\[?)([^",\])]+)/;
    const newLine = lineToChange.replace(regex, `$1${upgrade.newVersion}`);
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new nuget value');
    return null;
  }
}
