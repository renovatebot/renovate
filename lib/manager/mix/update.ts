import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  logger.debug(`mix.updateDependency: ${upgrade.newValue}`);

  const lines = fileContent.split('\n');
  const lineToChange = lines[upgrade.managerData.lineNumber];

  if (!lineToChange.includes(upgrade.depName)) return null;

  const newLine = lineToChange.replace(/"(.*?)"/, `"${upgrade.newValue}"`);

  if (newLine === lineToChange) {
    logger.debug('No changes necessary');
    return fileContent;
  }

  lines[upgrade.managerData.lineNumber] = newLine;
  return lines.join('\n');
}
