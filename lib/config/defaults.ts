import { getOptions } from './definitions';
import type { GlobalConfig, RenovateOptions } from './types';

const defaultValues = {
  boolean: true,
  array: [],
  string: null,
  object: null,
};

export function getDefault(option: RenovateOptions): any {
  return option.default === undefined
    ? defaultValues[option.type]
    : option.default;
}

export function getConfig(): GlobalConfig {
  const options = getOptions();
  const config: GlobalConfig = {};
  options.forEach((option) => {
    if (!option.parent) {
      config[option.name] = getDefault(option);
    }
  });
  return config;
}
