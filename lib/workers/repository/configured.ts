import type { RenovateConfig } from '../../config/types';
import {
  REPOSITORY_DISABLED_BY_CONFIG,
  REPOSITORY_FORKED,
} from '../../constants/error-messages';
import { RepositoryError } from '../../util/errors';

export function checkIfConfigured(config: RenovateConfig): void {
  if (config.enabled === false) {
    throw new RepositoryError(REPOSITORY_DISABLED_BY_CONFIG, config.repository);
  }
  if (config.isFork && !config.includeForks) {
    throw new RepositoryError(REPOSITORY_FORKED, config.repository);
  }
}
