import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { UpdateDependencyConfig } from '../common';
import { regEx } from '../../util/regex';

export default function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    const newFrom = getNewFrom(updateOptions);
    logger.debug(`ansible.updateDependency(): ${newFrom}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[updateOptions.managerData.lineNumber];
    const imageLine = regEx(`^(\\s*image:\\s*'?"?)[^\\s'"]+('?"?\\s*)$`);
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
