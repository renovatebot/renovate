import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  logger.debug(`mix.updateDependency: ${updateOptions.newValue}`);

  const lines = fileContent.split('\n');
  const lineToChange = lines[updateOptions.managerData.lineNumber];

  if (!lineToChange.includes(updateOptions.depName)) return null;

  const newLine = lineToChange.replace(
    /"(.*?)"/,
    `"${updateOptions.newValue}"`
  );

  if (newLine === lineToChange) {
    logger.debug('No changes necessary');
    return fileContent;
  }

  lines[updateOptions.managerData.lineNumber] = newLine;
  return lines.join('\n');
}
