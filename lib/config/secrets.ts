import is from '@sindresorhus/is';
import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
} from '../constants/error-messages';
import { logger } from '../logger';
import { regEx } from '../util/regex';
import { addSecretForSanitizing } from '../util/sanitize';
import type { AllConfig, RenovateConfig } from './types';

const secretNamePattern = '[A-Za-z][A-Za-z0-9_]*';

const secretNameRegex = regEx(`^${secretNamePattern}$`);
const secretTemplateRegex = regEx(`{{ secrets\\.(${secretNamePattern}) }}`);

function validateSecrets(secrets_: unknown): void {
  if (!secrets_) {
    return;
  }
  const validationErrors: string[] = [];
  if (is.plainObject(secrets_)) {
    for (const [secretName, secretValue] of Object.entries(secrets_)) {
      if (!secretNameRegex.test(secretName)) {
        validationErrors.push(`Invalid secret name "${secretName}"`);
      }
      if (!is.string(secretValue)) {
        validationErrors.push(
          `Secret values must be strings. Found type ${typeof secretValue} for secret ${secretName}`,
        );
      }
    }
  } else {
    validationErrors.push(
      `Config secrets must be a plain object. Found: ${typeof secrets_}`,
    );
  }
  if (validationErrors.length) {
    logger.error({ validationErrors }, 'Invalid secrets configured');
    throw new Error(CONFIG_SECRETS_INVALID);
  }
}

export function validateConfigSecrets(config: AllConfig): void {
  validateSecrets(config.secrets);
  if (config.repositories) {
    for (const repository of config.repositories) {
      if (is.plainObject(repository)) {
        validateSecrets(repository.secrets);
      }
    }
  }
}

function replaceSecretsInString(
  key: string,
  value: string,
  secrets: Record<string, string>,
): string {
  // do nothing if no secret template found
  if (!secretTemplateRegex.test(value)) {
    return value;
  }

  const disallowedPrefixes = ['branch', 'commit', 'group', 'pr', 'semantic'];
  if (disallowedPrefixes.some((prefix) => key.startsWith(prefix))) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'config';
    error.validationError = 'Disallowed secret substitution';
    error.validationMessage = `The field \`${key}\` may not use secret substitution`;
    throw error;
  }
  return value.replace(secretTemplateRegex, (_, secretName) => {
    if (secrets?.[secretName]) {
      return secrets[secretName];
    }
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'config';
    error.validationError = 'Unknown secret name';
    error.validationMessage = `The following secret name was not found in config: ${String(
      secretName,
    )}`;
    throw error;
  });
}

function replaceSecretsInObject(
  config_: RenovateConfig,
  secrets: Record<string, string>,
  deleteSecrets: boolean,
): RenovateConfig {
  const config = { ...config_ };
  if (deleteSecrets) {
    delete config.secrets;
  }
  for (const [key, value] of Object.entries(config)) {
    if (is.plainObject(value)) {
      config[key] = replaceSecretsInObject(value, secrets, deleteSecrets);
    }
    if (is.string(value)) {
      config[key] = replaceSecretsInString(key, value, secrets);
    }
    if (is.array(value)) {
      for (const [arrayIndex, arrayItem] of value.entries()) {
        if (is.plainObject(arrayItem)) {
          value[arrayIndex] = replaceSecretsInObject(
            arrayItem,
            secrets,
            deleteSecrets,
          );
        } else if (is.string(arrayItem)) {
          value[arrayIndex] = replaceSecretsInString(key, arrayItem, secrets);
        }
      }
    }
  }
  return config;
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
  return replaceSecretsInObject(config, secrets as never, deleteSecrets);
}
