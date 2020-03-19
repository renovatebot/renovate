import YAWN from 'yawn-yaml/cjs';
import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  try {
    const { depName, newValue } = upgrade;

    const yawn = new YAWN(fileContent);

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
    logger.debug({ err }, 'Error setting new .gitlab-ci.yml include value');
    return null;
  }
}
