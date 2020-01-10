import {
  REPOSITORY_DISABLED,
  REPOSITORY_FORKED,
} from '../../constants/error-messages';

export function checkIfConfigured(config) {
  if (config.enabled === false) {
    throw new Error(REPOSITORY_DISABLED);
  }
  if (config.isFork && !config.includeForks) {
    throw new Error(REPOSITORY_FORKED);
  }
}
