import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export default function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    logger.debug(`ansible-galaxy.updateDependency(): ${upgrade.newValue}`);
    const lines = fileContent.split('\n');
    const lineToChange = lines[upgrade.managerData.lineNumber];
    const regexMatchNewBlock = new RegExp(
      /^(\s?-?\s?(src|scm|version|name):\s*["']?)([^"']*)(["']?.*)$/
    );
    if (!regexMatchNewBlock.exec(lineToChange)) {
      logger.debug('No version line found');
      return null;
    }
    const newLine = lineToChange.replace(
      regexMatchNewBlock,
      `$1${upgrade.newValue}$4`
    );
    if (newLine === lineToChange) {
      logger.debug('No changes necessary');
      return fileContent;
    }
    lines[upgrade.managerData.lineNumber] = newLine;
    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new ansible-galaxy role version value');
    return null;
  }
}
