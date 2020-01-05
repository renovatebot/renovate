import YAWN from 'yawn-yaml/cjs';
import { logger } from '../../logger';
import { Upgrade } from '../common';

function findAndUpdateFirstImageMatch(
  parsedContent: object,
  depName: string,
  currentVersion: string,
  newVersion: string,
  fullContent: object
): object {
  if (parsedContent && typeof parsedContent === 'object') {
    Object.keys(parsedContent).forEach(key => {
      if (parsedContent[key] && typeof parsedContent[key] === 'object') {
        if (
          key === 'image' &&
          parsedContent[key] &&
          parsedContent[key].tag === currentVersion
        ) {
          parsedContent[key].tag = newVersion;
        } else {
          findAndUpdateFirstImageMatch(
            parsedContent[key],
            depName,
            currentVersion,
            newVersion,
            fullContent
          );
        }
      }
    });
  }
  return fullContent;
}

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  if (!upgrade || !upgrade.depName || !upgrade.newValue || !upgrade.newValue) {
    logger.debug('Failed to update dependency, invalid upgrade');
    return fileContent;
  }

  try {
    const yawn = new YAWN(fileContent);

    const doc = yawn.json;
    logger.debug({ fileContent });
    logger.debug({ upgrade }, 'updateDependency()');
    logger.debug({ doc }, 'updateDependency()');

    doc.image.tag = upgrade.newValue;

    yawn.json = findAndUpdateFirstImageMatch(
      doc,
      upgrade.depName,
      upgrade.currentVersion,
      upgrade.newVersion,
      doc
    );
    logger.debug({ doc: yawn.yaml }, 'updateDependency()');

    return yawn.yaml;
  } catch (err) {
    logger.info({ err }, 'Error setting new helm values file docker tag');
    return null;
  }
}
