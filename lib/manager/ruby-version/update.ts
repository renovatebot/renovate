import { logger } from '../../logger';
import { UpdateDependencyConfig } from '../common';

export function updateDependency({ upgrade }: UpdateDependencyConfig): string {
  logger.debug(`ruby-version.updateDependency(): ${upgrade.newValue}`);
  return `${upgrade.newValue}\n`;
}
