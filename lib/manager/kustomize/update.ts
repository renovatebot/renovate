import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { UpdateDependencyConfig } from '../common';
import { extractBases } from './common';
import { safeDump } from 'js-yaml';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    if (!fileContent || !upgrade) {
      return null;
    }

    var lines = fileContent.split('\n');

    for (var i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(upgrade.source)) {
        const newLine = line.replace(upgrade.currentValue, upgrade.newValue);
        lines[i] = newLine;
      }
    }

    return lines.join('\n');
  } catch (err) {
    logger.info({ err }, 'Error setting new Kubernetes value');
    console.log(err);
    return null;
  }
}
