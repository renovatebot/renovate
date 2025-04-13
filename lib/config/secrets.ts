import is from '@sindresorhus/is';
import type { InterpolatorOptions } from '../util/interpolators';
import {
  replaceInterpolatedValuesInObject,
  validateInterpolatedValues,
} from '../util/interpolators';
import { addSecretForSanitizing } from '../util/sanitize';
import type { AllConfig, RenovateConfig } from './types';

const secretNamePattern = '[A-Za-z][A-Za-z0-9_]*';
const secretTemplatePattern = `{{ secrets\\.(${secretNamePattern}) }}`;
// const secretNameRegex = regEx(`^${secretNamePattern}$`);
// const secretTemplateRegex = regEx(

const options: InterpolatorOptions = {
  name: 'secrets',
  nameRegexPattern: secretNamePattern,
  templateRegexPattern: secretTemplatePattern,
};

export function validateConfigSecrets(config: AllConfig): void {
  validateInterpolatedValues(config.secrets, options);
  if (config.repositories) {
    for (const repository of config.repositories) {
      if (is.plainObject(repository)) {
        validateInterpolatedValues(repository.secrets, options);
      }
    }
  }
}

export function applySecretsToConfig(
  config: RenovateConfig,
  secrets = config.secrets,
  deleteSecrets = true,
): RenovateConfig {
  // Add all secrets to be sanitized
  if (is.plainObject(secrets)) {
    for (const secret of Object.values(secrets)) {
      addSecretForSanitizing(secret);
    }
  }
  // TODO: fix types (#9610)
  return replaceInterpolatedValuesInObject(
    config,
    secrets!,
    options,
    deleteSecrets,
  );
}
