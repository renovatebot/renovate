import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { Upgrade } from '../common';

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string {
  try {
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    if (upgrade.depType === 'docker') {
      const newFrom = getNewFrom(upgrade);
      logger.debug(`droneci.updateDependency(): ${newFrom}`);
      const imageLine = new RegExp(/^(\s* image:\s*'?"?)[^\s'"]+('?"?\s*)$/);
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
    }
    logger.error('Unknown DroneCI depType');
    return null;
  } catch (err) {
    logger.info({ err }, 'Error setting new DroneCI image value');
    return null;
  }
}
