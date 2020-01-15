import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({ upgrade }: UpdateDependencyConfig): string {
  logger.debug(`nvm.updateDependency(): ${upgrade.newVersion}`);
  return `${upgrade.newValue}\n`;
}
