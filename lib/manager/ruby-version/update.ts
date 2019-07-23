import { logger } from '../../logger';
import { Upgrade } from '../common';

export function updateDependency(
  _fileContent: string,
  upgrade: Upgrade
): string {
  logger.debug(`ruby-version.updateDependency(): ${upgrade.newValue}`);
  return `${upgrade.newValue}\n`;
}
