import { isPlainObject } from '@sindresorhus/is';
import type { InterpolatorOptions } from '../util/interpolator.ts';
import {
  replaceInterpolatedValuesInObject,
  validateInterpolatedValues,
} from '../util/interpolator.ts';
import { coerceObject } from '../util/object.ts';
import { regEx } from '../util/regex.ts';
import { addSecretForSanitizing } from '../util/sanitize.ts';
import type { AllConfig, RenovateConfigFile } from './types.ts';

const namePattern = '[A-Za-z][A-Za-z0-9_]*';
const nameRegex = regEx(`^${namePattern}$`);
const secretTemplateRegex = regEx(`{{ *secrets\\.(${namePattern}) *}}`, 'g');
const variableTemplateRegex = regEx(
  `{{ *variables\\.(${namePattern}) *}}`,
  'g',
);

export const options: Record<'secrets' | 'variables', InterpolatorOptions> = {
  secrets: {
    name: 'secrets',
    nameRegex,
    templateRegex: secretTemplateRegex,
  },
  variables: {
    name: 'variables',
    nameRegex,
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
      if (isPlainObject(repository)) {
        validateInterpolatedValues(repository[key], options[key]);
      }
    }
  }
}

export function validateConfigSecretsAndVariables(
  config: RenovateConfigFile,
): void {
  validateNestedInterpolatedValues(config, 'secrets');
  validateNestedInterpolatedValues(config, 'variables');
}

interface ApplySecretsAndVariablesConfig<
  T extends RenovateConfigFile = RenovateConfigFile,
> {
  config: T;
  secrets?: RenovateConfigFile['secrets'];
  variables?: RenovateConfigFile['variables'];
  deleteSecrets?: boolean;
  deleteVariables?: boolean;
}

/**
 * Applies both variables and secrets to the Renovate config by interpolating values
 *
 * The config keeps its type other than the secrets and variables it deletes, as interpolating only replaces strings.
 */
export function applySecretsAndVariablesToConfig<T extends RenovateConfigFile>(
  applyConfig: ApplySecretsAndVariablesConfig<T> & {
    deleteSecrets: false;
    deleteVariables: false;
  },
): T;
export function applySecretsAndVariablesToConfig<T extends RenovateConfigFile>(
  applyConfig: ApplySecretsAndVariablesConfig<T> & {
    deleteSecrets?: true;
    deleteVariables?: true;
  },
): Omit<T, 'secrets' | 'variables'>;
export function applySecretsAndVariablesToConfig(
  applyConfig: ApplySecretsAndVariablesConfig,
): RenovateConfigFile;
export function applySecretsAndVariablesToConfig(
  applyConfig: ApplySecretsAndVariablesConfig,
): RenovateConfigFile {
  const { config, deleteSecrets, deleteVariables } = applyConfig;
  const secrets = applyConfig.secrets ?? config.secrets;
  const variables = applyConfig.variables ?? config.variables;

  // Add all secrets to be sanitized
  if (isPlainObject(secrets)) {
    for (const secret of Object.values(secrets)) {
      addSecretForSanitizing(secret);
    }
  }

  const configWithVars = replaceInterpolatedValuesInObject(
    config,
    coerceObject(variables),
    options.variables,
    deleteVariables,
  );

  return replaceInterpolatedValuesInObject(
    configWithVars,
    coerceObject(secrets),
    options.secrets,
    deleteSecrets,
  );
}
