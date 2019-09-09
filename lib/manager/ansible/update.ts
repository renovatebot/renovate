import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { Upgrade } from '../common';
import { regEx } from '../../util/regex';

export default function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    const newFrom = getNewFrom(upgrade);
    logger.debug(`ansible.updateDependency(): ${newFrom}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    const imageLine = regEx(`^(\\s*image:\\s*'?"?)[^\\s'"]+('?"?\\s*)$`);
    if (!lineToChange.match(imageLine)) {
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
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
