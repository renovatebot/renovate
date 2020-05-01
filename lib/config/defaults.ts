import { RenovateConfig } from './common';
import { RenovateOptions, getOptions } from './definitions';

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

export function getConfig(): RenovateConfig {
  const options = getOptions();
  const config: RenovateConfig = {};
  options.forEach((option) => {
    if (!option.parent) {
      config[option.name] = getDefault(option);
    }
  });
  return config;
}
