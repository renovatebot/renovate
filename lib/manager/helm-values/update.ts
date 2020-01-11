import YAWN from 'yawn-yaml/cjs';
import { logger } from '../../logger';
import { Upgrade } from '../common';
import { matchesHelmValuesDockerHeuristic } from './util';

/**
 * Recursive function that walks the yaml strucuture depth-first
 * and updates the first match of an 'image' key it finds,
 * if it adheres to the supported structure.
 *
 * @param parsedContent The part of the yaml tree we should look at.
 * @param depName The
 * @param currentValue
 * @param newValue
 */
function updateDoc(
  parsedContent: object,
  depName: string,
  currentValue: string,
  newValue: string
): void {
  Object.keys(parsedContent).forEach(key => {
    logger.warn(key);
    logger.warn(parsedContent[key]);
    if (
      matchesHelmValuesDockerHeuristic(key, parsedContent[key]) &&
      parsedContent[key].repository === depName &&
      parsedContent[key].tag === currentValue
    ) {
      logger.warn('updating');
      parsedContent[key].tag = newValue;
    } else if (typeof parsedContent[key] === 'object') {
      updateDoc(parsedContent[key], depName, currentValue, newValue);
    }
  });
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  if (
    !upgrade ||
    !upgrade.depName ||
    !upgrade.newValue ||
    !upgrade.currentValue
  ) {
    logger.debug('Failed to update dependency, invalid upgrade');
    return fileContent;
  }

  try {
    const yawn = new YAWN(fileContent);

    const doc = yawn.json;
    logger.warn({ fileContent });
    logger.warn({ upgrade }, 'updateDependency()');
    logger.warn({ doc }, 'updateDependency()');

    updateDoc(doc, upgrade.depName, upgrade.currentValue, upgrade.newValue);
    yawn.json = doc;
    logger.warn({ doc: yawn.yaml }, 'updateDependency()');

    return yawn.yaml;
  } catch (err) {
    logger.info({ err }, 'Error setting new helm values file docker tag');
    return null;
  }
}
