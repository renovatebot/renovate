import type { RenovateConfig } from '../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
} from '../../constants/error-messages';
import { RepositoryError } from '../../types/semantic-errors/RepositoryError';

export function checkIfConfigured(config: RenovateConfig): void {
  if (config.enabled === false) {
    throw new RepositoryError(config.repository, REPOSITORY_DISABLED_BY_CONFIG);
  }
  if (config.isFork && !config.includeForks) {
    throw new RepositoryError(config.repository, REPOSITORY_FORKED);
  }
}
