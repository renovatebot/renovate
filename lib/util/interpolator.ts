import { isArray, isPlainObject, isString } from '@sindresorhus/is';
import type { RenovateConfig } from '../config/types';
import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
  CONFIG_VARIABLES_INVALID,
} from '../constants/error-messages';
import { logger } from '../logger';
import { capitalize } from './string';

export interface InterpolatorOptions {
  name: 'secrets' | 'variables';
  templateRegex: RegExp;
  nameRegex: RegExp;
}

export function validateInterpolatedValues(
  input: unknown,
  options: InterpolatorOptions,
): void {
  if (!input) {
    return;
  }

  const { name, nameRegex } = options;

  const validationErrors: string[] = [];
  if (isPlainObject(input)) {
    for (const [key, value] of Object.entries(input)) {
      if (!nameRegex.test(key)) {
        validationErrors.push(`Invalid ${name} name "${key}"`);
      }
      if (!isString(value)) {
        validationErrors.push(
          `${capitalize(name)} values must be strings. Found type ${typeof value} for ${name} ${key}`,
        );
      }
    }
  } else {
    validationErrors.push(
      `Config ${name}s must be a plain object. Found: ${typeof input}`,
    );
  }

  if (validationErrors.length) {
    logger.error({ validationErrors }, `Invalid ${name}s configured`);
    throw new Error(
      name === 'secrets' ? CONFIG_SECRETS_INVALID : CONFIG_VARIABLES_INVALID,
    );
  }
}

function replaceInterpolatedValuesInString(
  key: string,
  value: string,
  input: Record<string, string>,
  options: InterpolatorOptions,
): string {
  const { name, templateRegex } = options;
  // Reset regex lastIndex for global regexes to ensure consistent behavior
  templateRegex.lastIndex = 0;

  // do nothing if no interpolator template found
  if (!templateRegex.test(value)) {
    return value;
  }

  const disallowedPrefixes = ['branch', 'commit', 'group', 'pr', 'semantic'];
  if (disallowedPrefixes.some((prefix) => key.startsWith(prefix))) {
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'config';
    error.validationError = `Disallowed ${name} substitution`;
    error.validationMessage = `The field \`${key}\` may not use ${name} substitution`;
    throw error;
  }
  return value.replace(templateRegex, (_, key) => {
    if (input?.[key]) {
      return input[key];
    }
    const error = new Error(CONFIG_VALIDATION);
    error.validationSource = 'config';
    error.validationError = `Unknown ${name} name`;
    error.validationMessage = `The following ${name} name was not found in config: ${String(
      key,
    )}`;
    throw error;
  });
}

export function replaceInterpolatedValuesInObject(
  config_: RenovateConfig,
  input: Record<string, string>,
  options: InterpolatorOptions,
  deleteValues = true,
): RenovateConfig {
  const config = { ...config_ };
  const { name } = options;
  if (deleteValues) {
    delete config[name];
  }
  for (const [key, value] of Object.entries(config)) {
    if (isPlainObject(value) && key !== 'onboardingConfig') {
      // @ts-expect-error -- type can't be narrowed
      config[key] = replaceInterpolatedValuesInObject(
        value,
        input,
        options,
        deleteValues,
      );
    }
    if (isString(value)) {
      // @ts-expect-error -- type can't be narrowed
      config[key] = replaceInterpolatedValuesInString(
        key,
        value,
        input,
        options,
      );
    }
    if (isArray(value)) {
      for (const [arrayIndex, arrayItem] of value.entries()) {
        if (isPlainObject(arrayItem)) {
          value[arrayIndex] = replaceInterpolatedValuesInObject(
            arrayItem,
            input,
            options,
            deleteValues,
          );
        } else if (isString(arrayItem)) {
          value[arrayIndex] = replaceInterpolatedValuesInString(
            key,
            arrayItem,
            input,
            options,
          );
        }
      }
    }
  }
  return config;
}
