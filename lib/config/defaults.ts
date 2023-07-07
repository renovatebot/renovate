import { getOptions } from './options';
import type { AllConfig, RenovateOptions } from './types';

// Use functions instead of direct values to avoid introducing global references.
// In particular, we want a new array instance every time we request a default array
// instead of sharing a single instance - mutation of this value could cause serious problems.
// See https://github.com/mend/renovate-on-prem/issues/290 for an example
const defaultValueFactories = {
  boolean: () => true,
  array: () => [],
  string: () => null,
  object: () => null,
  integer: () => null,
} as const;

export function getDefault(option: RenovateOptions): any {
  return option.default === undefined
    ? defaultValueFactories[option.type]()
    : option.default;
}

export function getConfig(): AllConfig {
  const options = getOptions();
  const config: AllConfig = {};
  options.forEach((option) => {
    if (!option.parent) {
      config[option.name] = getDefault(option);
    }
  });
  return config;
}
