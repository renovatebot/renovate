import { logger } from '../../../logger';
import type { UpdateDependencyConfig } from '../types';

const updateLine = '#copier updated';

/**
 * updateDependency appends a comment line once.
 * This is only for the purpose of triggering the artifact update.
 * Copier needs to update its answers file itself.
 */
export function updateDependency({
  fileContent,
  upgrade,
}: UpdateDependencyConfig): string | null {
  logger.trace({ upgrade }, `copier.updateDependency()`);
  if (!fileContent.endsWith(updateLine)) {
    logger.debug(`append update line to the fileContent if it hasn't been`);
    return `${fileContent}\n${updateLine}`;
  }

  return fileContent;
}
