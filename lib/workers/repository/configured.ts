import {
  REPOSITORY_DISABLED,
  REPOSITORY_FORKED,
} from '../../constants/error-messages';
import { RenovateConfig } from '../../config';

export function checkIfConfigured(config: RenovateConfig): void {
  if (config.enabled === false) {
    throw new Error(REPOSITORY_DISABLED);
  }
  if (config.isFork && !config.includeForks) {
    throw new Error(REPOSITORY_FORKED);
  }
}
