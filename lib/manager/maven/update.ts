import { logger } from '../../logger';
import type { UpdateDependencyConfig, Upgrade } from '../types';

export function updateAtPosition(
  fileContent: string,
  upgrade: Upgrade,
  endingAnchor: string
): string | null {
  const { depName, currentValue, newValue, fileReplacePosition } = upgrade;
  const leftPart = fileContent.slice(0, fileReplacePosition);
  const rightPart = fileContent.slice(fileReplacePosition);
  const versionClosePosition = rightPart.indexOf(endingAnchor);
  const restPart = rightPart.slice(versionClosePosition);
  const versionPart = rightPart.slice(0, versionClosePosition);
  const version = versionPart.trim();
  if (version === newValue) {
    return fileContent;
  }
  if (version === currentValue || upgrade.groupName) {
    const replacedPart = versionPart.replace(version, newValue);
    return leftPart + replacedPart + restPart;
  }
  logger.debug({ depName, version, currentValue, newValue }, 'Unknown value');
  return null;
}

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const offset = fileContent.indexOf('<');
  const spaces = fileContent.slice(0, offset);
  const restContent = fileContent.slice(offset);
  const updatedContent = updateAtPosition(restContent, upgrade, '</');
  if (!updatedContent) {
    return null;
  }
  if (updatedContent === restContent) {
    return fileContent;
  }
  return `${spaces}${updatedContent}`;
}
