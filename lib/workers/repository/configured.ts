import { RenovateConfig } from '../../config';

export function checkIfConfigured(config: RenovateConfig): void {
  if (config.enabled === false) {
    throw new Error('disabled');
  }
  if (config.isFork && !config.includeForks) {
    throw new Error('fork');
  }
}
