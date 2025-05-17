import is from '@sindresorhus/is';
import type { InterpolatorOptions } from '../util/interpolator';
import {
  replaceInterpolatedValuesInObject,
  validateInterpolatedValues,
} from '../util/interpolator';
import { regEx } from '../util/regex';
import type { AllConfig, RenovateConfig } from './types';

const variableNamePattern = '[A-Za-z][A-Za-z0-9_]*';
const variableNameRegex = regEx(`^${variableNamePattern}$`);
const variableTemplateRegex = regEx(
  `{{ variables\\.(${variableNamePattern}) }}`,
);

const options: InterpolatorOptions = {
  name: 'variables',
  nameRegex: variableNameRegex,
  templateRegex: variableTemplateRegex,
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
