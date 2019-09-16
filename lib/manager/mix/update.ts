import { logger } from '../../logger';

export function updateDependency(currentFileContent, upgrade) {
  try {
    logger.debug(`mix.updateDependency: ${upgrade.newValue}`);

    if (upgrade.datasource !== 'hex')
      throw new Error('Unsupported dependency type');

    const lines = currentFileContent.split('\n');
    const lineToChange = lines[upgrade.lineNumber];
    let newLine = lineToChange;

    if (!lineToChange.includes(upgrade.depName))
      throw new Error('Wrong dependency line');

    newLine = lineToChange.replace(/"(.*?)"/, `"${upgrade.newValue}"`);

    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return currentFileContent;
    }

    lines[upgrade.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new mix module version');
    return null;
  }
}
