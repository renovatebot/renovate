import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({
  updateOptions,
}: UpdateDependencyConfig): string {
  logger.debug(`nvm.updateDependency(): ${updateOptions.newVersion}`);
  return `${updateOptions.newValue}\n`;
}
