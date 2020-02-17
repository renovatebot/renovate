import {
  DATASOURCE_GIT_TAGS,
  DATASOURCE_DOCKER,
} from '../../constants/data-binary-source';
import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

function updateBase({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    const lines = fileContent.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.includes(upgrade.depName)) {
        const newLine = line.replace(upgrade.currentValue, upgrade.newValue);
        lines[i] = newLine;
      }
    }

    return lines.join('\n');
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

function updateImageTag({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    const lines = fileContent.split('\n');

    let prev_line = lines[0];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];

      // we found a match
      if (line.includes(`name: ${upgrade.depName}`)) {
        const x = /^(\s+)?- name:.*$/.exec(line);
        // check if we are at the beginning of the list
        if (x) {
          lines[i + 1] = lines[i + 1].replace(
            upgrade.currentValue,
            upgrade.newValue
          );
        } else {
          lines[i - 1] = prev_line.replace(
            upgrade.currentValue,
            upgrade.newValue
          );
        }
      }

      // save the previous line, we may need it
      prev_line = line;
    }

    return lines.join('\n');
  } catch (err) /* istanbul ignore next */ {
    return null;
  }
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  if (!fileContent || !upgrade) {
    return fileContent;
  }

  if (upgrade.depType === DATASOURCE_GIT_TAGS) {
    return updateBase({ fileContent, upgrade });
  }
  if (upgrade.depType === DATASOURCE_DOCKER) {
    return updateImageTag({ fileContent, upgrade });
  }
  logger.warn(`datasource type not supported ${upgrade.depType}`);
  return fileContent;
}
