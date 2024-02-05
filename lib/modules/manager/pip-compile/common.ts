import is from '@sindresorhus/is';
import { logger } from '../../../logger';
import { regEx } from '../../../util/regex';
import type { UpdateArtifactsConfig } from '../types';

export function getPythonConstraint(
  config: UpdateArtifactsConfig,
): string | undefined | null {
  const { constraints = {} } = config;
  const { python } = constraints;

  if (python) {
    logger.debug('Using python constraint from config');
    return python;
  }

  return undefined;
}
export function getPipToolsConstraint(config: UpdateArtifactsConfig): string {
  const { constraints = {} } = config;
  const { pipTools } = constraints;

  if (is.string(pipTools)) {
    logger.debug('Using pipTools constraint from config');
    return pipTools;
  }

  return '';
}
export const constraintLineRegex = regEx(
  /^(#.*?\r?\n)+# {4}pip-compile(?<arguments>.*?)\r?\n/,
);
export const allowedPipArguments = [
  '--allow-unsafe',
  '--generate-hashes',
  '--no-emit-index-url',
  '--strip-extras',
];
