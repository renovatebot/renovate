import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(
  currentFileContent: string,
  upgrade: Upgrade
): string | null {
  try {
    logger.debug(`terraform-provider.updateDependency: ${upgrade.newValue}`);
    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    let newLine = lineToChange;
    if (!lineToChange.match(/version\s*=\s*"/)) {
      return null;
    }
    newLine = lineToChange.replace(
      /(version\s*=\s*)"[^"]*"/,
      `$1"${upgrade.newValue}"`
    );
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) /* istanbul ignore next */ {
    logger.info({ err }, 'Error setting new terraform provider version');
    return null;
  }
}
