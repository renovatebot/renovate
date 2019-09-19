import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(fileContent: string, upgrade: Upgrade) {
  logger.debug(`mix.updateDependency: ${upgrade.newValue}`);

  const lines = fileContent.split('\n');
  const lineToChange = lines[upgrade.lineNumber];
  let newLine = lineToChange;

  if (!lineToChange.includes(upgrade.depName)) return null;

  newLine = lineToChange.replace(/"(.*?)"/, `"${upgrade.newValue}"`);

  if (newLine === lineToChange) {
    logger.debug('No changes necessary');
    return fileContent;
  }

  lines[upgrade.lineNumber] = newLine;
  return lines.join('\n');
}
