import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import type { UpdateArtifactsConfig } from '../types';

export function getPythonVersionConstraint(
  config: UpdateArtifactsConfig,
): string | undefined | null {
  const { constraints = {} } = config;
  const { python } = constraints;

  if (is.nonEmptyString(python)) {
    logger.debug('Using python constraint from config');
    return python;
  }

  return undefined;
}

export function getCopierVersionConstraint(
  config: UpdateArtifactsConfig,
): string {
  const { constraints = {} } = config;
  const { copier } = constraints;

  if (is.nonEmptyString(copier)) {
    logger.debug('Using copier constraint from config');
    return copier;
  }

  return '';
}
