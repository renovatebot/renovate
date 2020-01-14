import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    const newFrom = getNewFrom(updateOptions);
    const lines = fileContent.split('\n');
    const lineToChange = lines[updateOptions.managerData.lineNumber];
    if (['image', 'image-name'].includes(updateOptions.depType)) {
      const imageLine = new RegExp(
        /^(\s*(?:image|name):\s*'?"?)[^\s'"]+('?"?\s*)$/
      );
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
    }
    const serviceLine = /^(\s*-\s*'?"?)[^\s'"]+('?"?\s*)$/;
    if (!serviceLine.test(lineToChange)) {
      logger.debug('No image line found');
      return null;
    }
    const newLine = lineToChange.replace(serviceLine, `$1${newFrom}$2`);
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
