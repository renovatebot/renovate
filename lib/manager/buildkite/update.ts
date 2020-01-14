import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';
import { regEx } from '../../util/regex';

export function updateDependency({
  fileContent,
  updateOptions,
}: UpdateDependencyConfig): string | null {
  try {
    const lineIdx = updateOptions.managerData.lineNumber - 1;
    logger.debug(`buildkite.updateDependency: ${updateOptions.newValue}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[lineIdx];
    const depLine = regEx(`^(\\s+[^#]+#)[^:]+(.*)$`);
    if (!depLine.test(lineToChange)) {
      logger.debug('No image line found');
      return null;
    }
    const newLine = lineToChange.replace(
      depLine,
      `$1${updateOptions.newValue}$2`
    );
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[lineIdx] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new buildkite version');
    return null;
  }
}
