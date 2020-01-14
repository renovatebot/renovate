import { logger } from '../../logger';
import { Upgrade } from '../common';
import {
  DEP_TYPE_GITHUB,
  DEP_TYPE_TERRAFORM,
} from '../../constants/dependency';

export function updateDependency(
  currentFileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    logger.debug(`terraform.updateDependency: ${upgrade.newValue}`);
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    let newLine = lineToChange;
    if (upgrade.depType === DEP_TYPE_GITHUB) {
      if (!lineToChange.includes(upgrade.depNameShort)) {
        return null;
      }
      newLine = lineToChange.replace(/\?ref=.*"/, `?ref=${upgrade.newValue}"`);
    } else if (upgrade.depType === DEP_TYPE_TERRAFORM) {
      if (!lineToChange.match(/version\s*=\s*"/)) {
        return null;
      }
      newLine = lineToChange.replace(
        /(version\s*=\s*)"[^"]*"/,
        `$1"${upgrade.newValue}"`
      );
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) /* istanbul ignore next */ {
    logger.info({ err }, 'Error setting new terraform module version');
    return null;
  }
}
