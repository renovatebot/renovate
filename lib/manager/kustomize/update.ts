import {
  DATASOURCE_GIT_TAGS,
  DATASOURCE_DOCKER,
} from '../../constants/data-binary-source';
import { logger } from '../../logger';
import { getNewFrom } from '../dockerfile/update';
import { UpdateDependencyConfig } from '../common';
import { extractBases } from './common';
import { safeDump } from 'js-yaml';

function updateBase({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    if (!fileContent || !upgrade) {
      return fileContent;
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
    logger.info({ err }, 'Error setting new Kustomize value');
    return null;
  }
}

function updateImageTag({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    var lines = fileContent.split('\n');

    var prev_line = lines[0];
    for (var i = 0; i < lines.length; i++) {
      const line = lines[i];

      // we found a match
      if (line.includes(`name: ${upgrade.depName}`)) {
        var x = /^(\s+)?- name:.*$/.exec(line);
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
  } catch (err) {
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

  if (upgrade.datasource === DATASOURCE_GIT_TAGS) {
    return updateBase({ fileContent, upgrade });
  } else if (upgrade.datasource === DATASOURCE_DOCKER) {
    return updateImageTag({ fileContent, upgrade });
    process.exit(120);
  } else {
    logger.fatal(upgrade);
    process.exit(127);
  }
}
