import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    const lines = fileContent.split('\n');
    const lineToChange = lines[updateOptions.managerData.lineNumber];
    if (updateOptions.depType === 'docker') {
      const newFrom = getNewFrom(updateOptions);
      logger.debug(`circleci.updateDependency(): ${newFrom}`);
      const imageLine = new RegExp(/^(\s*- image:\s*'?"?)[^\s'"]+('?"?\s*)$/);
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
    if (updateOptions.depType === 'orb') {
      const orbLine = new RegExp(`^(\\s+${updateOptions.depName}:\\s[^@]+@).+$`);
      if (!orbLine.test(lineToChange)) {
        logger.debug('No image line found');
        return null;
      }
      const newLine = lineToChange.replace(
        orbLine,
        `$1${updateOptions.newValue}`
      );
      if (newLine === lineToChange) {
        logger.debug('No changes necessary');
        return fileContent;
      }
      lines[updateOptions.managerData.lineNumber] = newLine;
      return lines.join('\n');
    }
    logger.error('Unknown circleci depType');
    return null;
  } catch (err) {
    logger.info({ err }, 'Error setting new CircleCI image value');
    return null;
  }
}
