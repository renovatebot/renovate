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

export function validateConfigSecretsAndVariables(
  config: RenovateConfig,
): void {
  validateNestedInterpolatedValues(config, 'secrets');
  validateNestedInterpolatedValues(config, 'variables');
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
  const { config, deleteSecrets, deleteVariables } = applyConfig;
  const secrets = applyConfig.secrets ?? config.secrets;
  const variables = applyConfig.variables ?? config.variables;

  // Add all secrets to be sanitized
  if (is.plainObject(secrets)) {
    for (const secret of Object.values(secrets)) {
      addSecretForSanitizing(secret);
    }
  }

  const configWithVars = replaceInterpolatedValuesInObject(
    config,
    variables ?? {},
    options.variables,
    deleteVariables,
  );

  return replaceInterpolatedValuesInObject(
    configWithVars,
    secrets ?? {},
    options.secrets,
    deleteSecrets,
  );
}
