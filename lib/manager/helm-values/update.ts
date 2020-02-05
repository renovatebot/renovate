import YAWN from 'yawn-yaml/cjs';
import { logger } from '../../logger';
import { Upgrade } from '../common';
import {
  matchesHelmValuesDockerHeuristic,
  HelmDockerImageDependency,
} from './util';

function shouldUpdate(
  parentKey: string,
  data: unknown | HelmDockerImageDependency,
  dockerRepository: string,
  currentValue: string,
  originalRegistryValue: string
): boolean {
  return (
    matchesHelmValuesDockerHeuristic(parentKey, data) &&
    data.repository === dockerRepository &&
    data.tag === currentValue &&
    ((!data.registry && !originalRegistryValue) ||
      data.registry === originalRegistryValue)
  );
}

/**
 * Extract the originally set registry value if it is included in the depName.
 */
function getOriginalRegistryValue(
  depName: string,
  dockerRepository: string
): string {
  if (depName.length > dockerRepository.length) {
    return depName.substring(0, depName.lastIndexOf(dockerRepository) - 1);
  }
  return '';
}

/**
 * Recursive function that walks the yaml strucuture
 * and updates the first match of an 'image' key it finds,
 * if it adheres to the supported structure.
 *
 * @param parsedContent The part of the yaml tree we should look at.
 * @param dockerRepository The docker repository that should be updated.
 * @param currentValue The current version that should be updated.
 * @param newValue The update version that should be set instead of currentValue.
 * @returns True if the parsedContent was updated, false otherwise.
 */
function updateDoc(
  parsedContent: object | HelmDockerImageDependency,
  dockerRepository: string,
  currentValue: string,
  newValue: string,
  originalRegistryValue: string
): boolean {
  for (const key of Object.keys(parsedContent)) {
    if (
      shouldUpdate(
        key,
        parsedContent[key],
        dockerRepository,
        currentValue,
        originalRegistryValue
      )
    ) {
      // the next statement intentionally updates the passed in parameter
      // with the updated dependency value
      // eslint-disable-next-line no-param-reassign
      parsedContent[key].tag = newValue;

      return true;
    }

    if (parsedContent[key] && typeof parsedContent[key] === 'object') {
      const foundMatch = updateDoc(
        parsedContent[key],
        dockerRepository,
        currentValue,
        newValue,
        originalRegistryValue
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
    !upgrade.currentValue ||
    !upgrade.dockerRepository
  ) {
    logger.debug('Failed to update dependency, invalid upgrade');
    return fileContent;
  }

  const yawn = new YAWN(fileContent);
  const doc = yawn.json;

  const originalRegistryValue = getOriginalRegistryValue(
    upgrade.depName,
    upgrade.dockerRepository
  );
  updateDoc(
    doc,
    upgrade.dockerRepository,
    upgrade.currentValue,
    upgrade.newValue,
    originalRegistryValue
  );
  yawn.json = doc;

  return yawn.yaml;
}
