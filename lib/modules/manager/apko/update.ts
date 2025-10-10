import { logger } from '../../../logger';
import type { UpdateDependencyConfig } from '../types';

export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  const { depName, currentValue, newValue } = upgrade;

  if (!depName || !currentValue || !newValue) {
    logger.debug('Missing required fields for APK update');
    return null;
  }

  // For APK packages, we need to replace the full package specification
  // which includes the package name, equals sign, and version
  const oldPackageSpec = `${depName}=${currentValue}`;
  const newPackageSpec = `${depName}=${newValue}`;

  // Check if the old package specification exists in the file
  if (!fileContent.includes(oldPackageSpec)) {
    logger.debug(
      { depName, currentValue, oldPackageSpec },
      'Could not find package specification to replace',
    );
    return null;
  }

  // Replace the old package specification with the new one
  const newContent = fileContent.replace(oldPackageSpec, newPackageSpec);

  if (newContent === fileContent) {
    logger.debug('No changes made to package file');
    return null;
  }

  logger.debug(
    { depName, currentValue, newValue },
    'Successfully updated APK package version',
  );

  return newContent;
}
