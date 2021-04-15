import is from '@sindresorhus/is';
import { logger } from '../logger';
import { getManagerList } from '../manager';
import type { ManagerConfig, RenovateConfig } from './types';

export function applyEnabledManagersFilter(
  config: RenovateConfig
): RenovateConfig {
  const { enabledManagers = [] } = config;
  if (is.nonEmptyArray(enabledManagers)) {
    logger.debug({ enabledManagers }, 'Applying enabled managers filtering');
    const enabledSet = new Set([...enabledManagers]);
    for (const managerName of getManagerList()) {
      const manager = config[managerName] as ManagerConfig;
      if (manager) {
        manager.enabled = enabledSet.has(managerName);
      }
    }
  }
  return config;
}
