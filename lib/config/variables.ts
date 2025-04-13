import is from '@sindresorhus/is';
import type { InterpolatorOptions } from '../util/interpolators';
import {
  replaceInterpolatedValuesInObject,
  validateInterpolatedValues,
} from '../util/interpolators';
import type { AllConfig, RenovateConfig } from './types';

const variableNamePattern = '[A-Za-z][A-Za-z0-9_]*';
// const variableNameRegex = regEx(`^${variableNamePattern}$`);
const variableTemplatePattern = `{{ variables\\.(${variableNamePattern}) }}`;

const options: InterpolatorOptions = {
  name: 'variables',
  nameRegexPattern: variableNamePattern,
  templateRegexPattern: variableTemplatePattern,
};

export function validateConfigVariables(config: AllConfig): void {
  validateInterpolatedValues(config.variables, options);
  if (config.repositories) {
    for (const repository of config.repositories) {
      if (is.plainObject(repository)) {
        validateInterpolatedValues(repository.variables, options);
      }
    }
  }
}

export function applyVariablesToConfig(
  config: RenovateConfig,
  variables = config.variables,
  deleteVariables = true,
): RenovateConfig {
  return replaceInterpolatedValuesInObject(
    config,
    variables as never,
    options,
    deleteVariables,
  );
}
