import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(`terraform.updateDependency: ${updateOptions.newValue}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[updateOptions.managerData.lineNumber];
    let newLine = lineToChange;
    if (updateOptions.depType === 'github') {
      if (!lineToChange.includes(updateOptions.depNameShort)) {
        return null;
      }
      newLine = lineToChange.replace(
        /\?ref=.*"/,
        `?ref=${updateOptions.newValue}"`
      );
    } else if (updateOptions.depType === 'terraform') {
      if (!/version\s*=\s*"/.test(lineToChange)) {
        return null;
      }
      newLine = lineToChange.replace(
        /(version\s*=\s*)"[^"]*"/,
        `$1"${updateOptions.newValue}"`
      );
    }
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[updateOptions.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) /* istanbul ignore next */ {
    logger.info({ err }, 'Error setting new terraform module version');
    return null;
  }
}
