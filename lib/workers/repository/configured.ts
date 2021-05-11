import type { RenovateConfig } from '../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
} from '../../constants/error-messages';

export function checkIfConfigured(config: RenovateConfig): void {
  if (config.enabled === false) {
    throw new Error(REPOSITORY_DISABLED_BY_CONFIG);
  }
  if (config.isFork && !config.includeForks) {
    throw new Error(REPOSITORY_FORKED);
  }
}
