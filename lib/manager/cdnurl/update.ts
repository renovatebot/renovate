import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(
  fileContent: string,
  upgrade: Upgrade
): string | null {
  const { depName, currentValue, newValue, managerData } = upgrade;
  const { fileReplacePosition } = managerData;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const versionClosePosition = rightPart.indexOf('/');
  const restPart = rightPart.slice(versionClosePosition);
  const versionPart = rightPart.slice(0, versionClosePosition);
  const version = versionPart.trim();
  if (version === newValue) {
    return fileContent;
  }
  if (version === currentValue) {
    const replacedPart = versionPart.replace(version, newValue);
    return leftPart + replacedPart + restPart;
  }
  logger.debug(
    { depName, version, currentValue, newValue },
    'File content was changed in unexpected way'
  );
  return null;
}
