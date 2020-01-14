import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { Upgrade } from '../common';
import {
  DEP_TYPE_IMAGE,
  DEP_TYPE_IMAGE_NAME,
} from '../../constants/dependency';

export function updateDependency(
  currentFileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    const newFrom = getNewFrom(upgrade);
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    if ([DEP_TYPE_IMAGE, DEP_TYPE_IMAGE_NAME].includes(upgrade.depType)) {
      const imageLine = new RegExp(
        /^(\s*(?:image|name):\s*'?"?)[^\s'"]+('?"?\s*)$/
      );
      if (!lineToChange.match(imageLine)) {
        logger.debug('No image line found');
        return null;
      }
      const newLine = lineToChange.replace(imageLine, `$1${newFrom}$2`);
      if (newLine === lineToChange) {
        logger.debug('No changes necessary');
        return currentFileContent;
      }
      lines[upgrade.managerData.lineNumber] = newLine;
      return lines.join('\n');
    }
    const serviceLine = new RegExp(/^(\s*-\s*'?"?)[^\s'"]+('?"?\s*)$/);
    if (!lineToChange.match(serviceLine)) {
      logger.debug('No image line found');
      return null;
    }
    const newLine = lineToChange.replace(serviceLine, `$1${newFrom}$2`);
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Dockerfile value');
    return null;
  }
}
