import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    const newFrom = getNewFrom(upgrade);
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    if (['image', 'image-name'].includes(upgrade.depType)) {
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
      lines[upgrade.managerData.lineNumber] = newLine;
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
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
