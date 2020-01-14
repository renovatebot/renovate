import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  updateOptions,
}: UpdateDependencyConfig): string {
  logger.debug(`ruby-version.updateDependency(): ${updateOptions.newValue}`);
  return `${updateOptions.newValue}\n`;
}
