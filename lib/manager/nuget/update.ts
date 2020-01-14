import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(`nuget.updateDependency(): ${updateOptions.newFrom}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[updateOptions.managerData.lineNumber];
    const regex = /(Version\s*=\s*"\[?)([^",\])]+)/;
    const newLine = lineToChange.replace(
      regex,
      `$1${updateOptions.newVersion}`
    );
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[updateOptions.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new nuget value');
    return null;
  }
}
