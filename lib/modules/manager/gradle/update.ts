import { logger } from '../../../logger';
import type { UpdateDependencyConfig } from '../types';
import type { GradleManagerData } from './types';
import { versionLikeSubstring } from './utils';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig<GradleManagerData>): string | null {
  const { depName, currentValue, newValue, managerData, updateType } = upgrade;
  if (updateType === 'replacement') {
    logger.warn('gradle manager does not support replacement updates yet');
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  const offset = managerData!.fileReplacePosition;
  const leftPart = fileContent.slice(0, offset);
  const rightPart = fileContent.slice(offset);
  const version = versionLikeSubstring(rightPart);
  if (version) {
    const versionClosePosition = version.length;
    const restPart = rightPart.slice(versionClosePosition);
    if (version === newValue) {
      return fileContent;
    }
    if (version === currentValue || upgrade.groupName) {
      return leftPart + newValue + restPart;
    }
    logger.debug({ depName, version, currentValue, newValue }, 'Unknown value');
  } else {
    logger.debug({ depName, currentValue, newValue }, 'Wrong offset');
  }
  return null;
}
