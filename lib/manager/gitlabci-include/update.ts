import YAWN from 'yawn-yaml';
import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(
  currentFileContent: string,
  upgrade: Upgrade
): string {
  try {
    const { depName, newValue } = upgrade;

    const yawn = new YAWN(currentFileContent);

    const doc = yawn.json;

    for (const includeObj of doc.include) {
      if (
        includeObj.project &&
        includeObj.ref &&
        includeObj.project === depName
      ) {
        includeObj.ref = newValue;
      }
    }

    yawn.json = doc;

    return yawn.yaml;
  } catch (err) {
    logger.info({ err }, 'Error setting new .gitlab-ci.yml include value');
    return null;
  }
}
