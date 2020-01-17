import YAWN from 'yawn-yaml/cjs';
import { logger } from '../../logger';
import { Upgrade } from '../common';
import { matchesHelmValuesDockerHeuristic } from './util';

function shouldUpdate(
  parentKey: string,
  data: any,
  depName: string,
  currentValue: string
): boolean {
  return (
    matchesHelmValuesDockerHeuristic(parentKey, data) &&
    data.repository === depName &&
    data.tag === currentValue
  );
}

/**
 * Recursive function that walks the yaml strucuture
 * and updates the first match of an 'image' key it finds,
 * if it adheres to the supported structure.
 *
 * @param parsedContent The part of the yaml tree we should look at.
 * @param depName The name of the dependency that should be updated.
 * @param currentValue The current version that should be updated.
 * @param newValue The update version that should be set instead of currentValue.
 */
function updateDoc(
  parsedContent: object,
  depName: string,
  currentValue: string,
  newValue: string
): boolean {
  for (const key of Object.keys(parsedContent)) {
    if (shouldUpdate(key, parsedContent[key], depName, currentValue)) {
      // the next statement intentionally updates the passed in parameter
      // with the updated dependency value
      // eslint-disable-next-line no-param-reassign
      parsedContent[key].tag = newValue;
      return true;
    }

    if (typeof parsedContent[key] === 'object') {
      const foundMatch = updateDoc(
        parsedContent[key],
        depName,
        currentValue,
        newValue
      );
      if (foundMatch) {
        return true;
      }
    }
  }
  return false;
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

  const yawn = new YAWN(fileContent);
  const doc = yawn.json;

  updateDoc(doc, upgrade.depName, upgrade.currentValue, upgrade.newValue);
  yawn.json = doc;

  return yawn.yaml;
}
