import is from '@sindresorhus/is';
import type { InterpolatorOptions } from '../util/interpolator';
import {
  replaceInterpolatedValuesInObject,
  validateInterpolatedValues,
} from '../util/interpolator';
import { regEx } from '../util/regex';
import { addSecretForSanitizing } from '../util/sanitize';
import type { AllConfig, RenovateConfig } from './types';

const secretNamePattern = '[A-Za-z][A-Za-z0-9_]*';
const secretNameRegex = regEx(`^${secretNamePattern}$`);
const secretTemplateRegex = regEx(`{{ secrets\\.(${secretNamePattern}) }}`);
const variableNamePattern = '[A-Za-z][A-Za-z0-9_]*';

const variableNameRegex = regEx(`^${variableNamePattern}$`);
const variableTemplateRegex = regEx(
  `{{ variables\\.(${variableNamePattern}) }}`,
);

export const options: Record<'secrets' | 'variables', InterpolatorOptions> = {
  secrets: {
    name: 'secrets',
    nameRegex: secretNameRegex,
    templateRegex: secretTemplateRegex,
  },
  variables: {
    name: 'variables',
    nameRegex: variableNameRegex,
    templateRegex: variableTemplateRegex,
  },
};

function validateNestedInterpolatedValues<T extends 'secrets' | 'variables'>(
  config: AllConfig,
  key: T,
): void {
  validateInterpolatedValues(config[key], options[key]);
  if (config.repositories) {
    for (const repository of config.repositories) {
      if (is.plainObject(repository)) {
        validateInterpolatedValues(repository[key], options[key]);
      }
    }
  }
}

function validateConfigSecrets(config: AllConfig): void {
  validateNestedInterpolatedValues(config, 'secrets');
}

function validateConfigVariables(config: AllConfig): void {
  validateNestedInterpolatedValues(config, 'variables');
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
  return replaceInterpolatedValuesInObject(
    config,
    secrets ?? {},
    options.secrets,
    deleteSecrets,
  );
}

function applyVariablesToConfig(
  config: RenovateConfig,
  variables = config.variables,
  deleteVariables = true,
): RenovateConfig {
  return replaceInterpolatedValuesInObject(
    config,
    variables ?? {},
    options.variables,
    deleteVariables,
  );
}

export function validateConfigSecretsAndVariables(
  config: RenovateConfig,
): void {
  validateConfigSecrets(config);
  validateConfigVariables(config);
}

interface ApplySecretsAndVariablesConfig {
  config: RenovateConfig;
  secrets?: RenovateConfig['secrets'];
  variables?: RenovateConfig['variables'];
  deleteSecrets?: boolean;
  deleteVariables?: boolean;
}

/**
 * Applies both variables and secrets to the Renovate config by interpolating values
 */
export function applySecretsAndVariablesToConfig(
  applyConfig: ApplySecretsAndVariablesConfig,
): RenovateConfig {
  return applySecretsToConfig(
    applyVariablesToConfig(
      applyConfig.config,
      applyConfig.variables,
      applyConfig.deleteVariables,
    ),
    applyConfig.secrets,
    applyConfig.deleteSecrets,
  );
}
