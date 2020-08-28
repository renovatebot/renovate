import is from '@sindresorhus/is';
import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
} from '../constants/error-messages';
import { logger } from '../logger';
import { regEx } from '../util/regex';
import { add } from '../util/sanitize';
import { RenovateAdminConfig, RenovateConfig } from './common';

const secretNamePattern = '[A-Za-z][A-Za-z0-9_]*';

const secretNameRegex = regEx(`^${secretNamePattern}$`);
const secretTemplateRegex = regEx(`{{ secrets\\.(${secretNamePattern}) }}`);

export function validateSecrets(secrets_: unknown): void {
  if (!secrets_) {
    return;
  }
  const validationErrors: string[] = [];
  if (!is.plainObject(secrets_)) {
    validationErrors.push(
      `Config secrets must be a plain object. Found: ${typeof secrets_}`
    );
  }
  for (const [secretName, secretValue] of Object.entries(secrets_)) {
    if (!secretNameRegex.test(secretName)) {
      validationErrors.push(`Invalid secret name "${secretName}"`);
    }
    if (!is.string(secretValue)) {
      validationErrors.push(
        `Secret values must be strings. Found type ${typeof secretValue} for secret ${secretName}`
      );
    }
  }
  if (validationErrors.length) {
    logger.error({ validationErrors }, 'Invalid secrets configured');
    throw new Error(CONFIG_SECRETS_INVALID);
  }
}

export function validateConfigSecrets(config: RenovateAdminConfig): void {
  validateSecrets(config.secrets);
  if (config.repositories) {
    for (const repository of config.repositories) {
      if (is.plainObject(repository)) {
        validateSecrets(repository.secrets);
      }
    }
  }
}

export function replaceSecretsInString(
  value: string,
  secrets: Record<string, string>
): string {
  return value.replace(secretTemplateRegex, (_, secretName) => {
    if (secrets[secretName]) {
      return secrets[secretName];
    }
    const error = new Error(CONFIG_VALIDATION);
    error.configFile = 'config';
    error.validationError = 'Unknown secret name';
    error.validationMessage = `The following secret name was not found in config: ${String(
      secretName
    )}`;
    throw error;
  });
}

export function replaceSecretsinObject(
  config_: RenovateConfig,
  secrets: Record<string, string> = {}
): RenovateConfig {
  const config = { ...config_ };
  for (const [key, value] of Object.entries(config_)) {
    if (is.plainObject(value)) {
      config[key] = replaceSecretsinObject(value, secrets);
    }
    if (is.string(value)) {
      config[key] = replaceSecretsInString(value, secrets);
    }
    if (is.array(value)) {
      for (const [arrayIndex, arrayItem] of value.entries()) {
        if (is.plainObject(arrayItem)) {
          config[key][arrayIndex] = replaceSecretsinObject(arrayItem, secrets);
        } else if (is.string(arrayItem)) {
          config[key][arrayIndex] = replaceSecretsInString(arrayItem, secrets);
        }
      }
    }
  }
  delete config.secrets;
  return config;
}

export function applySecretsToConfig(config: RenovateConfig): RenovateConfig {
  // Add all secrets to be sanitized
  if (is.plainObject(config.secrets)) {
    for (const secret of Object.values(config.secrets)) {
      add(String(secret));
    }
  }
  return replaceSecretsinObject(config, config.secrets);
}
