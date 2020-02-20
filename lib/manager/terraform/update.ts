import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(`terraform.updateDependency: ${upgrade.newValue}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    let newLine = lineToChange;
    if (upgrade.depType === 'github') {
      if (!lineToChange.includes(upgrade.depNameShort)) {
        return null;
      }
      newLine = lineToChange.replace(/\?ref=.*"/, `?ref=${upgrade.newValue}"`);
    } else if (upgrade.depType === 'gitTags') {
      if (!lineToChange.includes(upgrade.depNameShort)) {
        return null;
      }
      newLine = lineToChange.replace(/\?ref=.*"/, `?ref=${upgrade.newValue}"`);
    } else if (upgrade.depType === 'terraform') {
      if (!/version\s*=\s*"/.test(lineToChange)) {
        return null;
      }
      newLine = lineToChange.replace(
        /(version\s*=\s*)"[^"]*"/,
        `$1"${upgrade.newValue}"`
      );
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) /* istanbul ignore next */ {
    logger.info({ err }, 'Error setting new terraform module version');
    return null;
  }
}
