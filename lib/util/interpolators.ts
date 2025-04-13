import is from '@sindresorhus/is';
import { capitalize } from '../../tools/docs/utils';
import type { RenovateConfig } from '../config/types';
import {
  CONFIG_SECRETS_INVALID,
  CONFIG_VALIDATION,
  CONFIG_VARIABLES_INVALID,
} from '../constants/error-messages';
import { logger } from '../logger';
import { regEx } from './regex';

export interface InterpolatorOptions {
  name: 'secrets' | 'variables';
  templateRegexPattern: string;
  nameRegexPattern: string;
}

export function validateInterpolatedValues(
  input: unknown,
  options: InterpolatorOptions,
): void {
  if (!input) {
    return;
  }

  const { name, nameRegexPattern } = options;
  const nameRegex = regEx(`^${nameRegexPattern}`);

  const validationErrors: string[] = [];
  if (is.plainObject(input)) {
    for (const [key, value] of Object.entries(input)) {
      if (!nameRegex.test(key)) {
        validationErrors.push(`Invalid ${name} name "${key}"`);
      }
      if (!is.string(value)) {
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
  const { name, templateRegexPattern } = options;
  const templateRegex = regEx(templateRegexPattern);
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
  deleteValues: boolean,
): RenovateConfig {
  const config = { ...config_ };
  const { name } = options;
  if (deleteValues) {
    delete config[name];
  }
  for (const [key, value] of Object.entries(config)) {
    if (is.plainObject(value)) {
      config[key] = replaceInterpolatedValuesInObject(
        value,
        input,
        options,
        deleteValues,
      );
    }
    if (is.string(value)) {
      config[key] = replaceInterpolatedValuesInString(
        key,
        value,
        input,
        options,
      );
    }
    if (is.array(value)) {
      for (const [arrayIndex, arrayItem] of value.entries()) {
        if (is.plainObject(arrayItem)) {
          value[arrayIndex] = replaceInterpolatedValuesInObject(
            arrayItem,
            input,
            options,
            deleteValues,
          );
        } else if (is.string(arrayItem)) {
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
