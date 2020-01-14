import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string {
  try {
    const newFrom = getNewFrom(updateOptions);
    logger.debug(`docker-compose.updateDependency(): ${newFrom}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[updateOptions.managerData.lineNumber];
    const imageLine = new RegExp(/^(\s*image:\s*'?"?)[^\s'"]+('?"?\s*)$/);
    if (!imageLine.test(lineToChange)) {
      logger.debug('No image line found');
      return null;
    }
    const newLine = lineToChange.replace(imageLine, `$1${newFrom}$2`);
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[updateOptions.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
