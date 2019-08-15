import { getOptions } from './definitions';

const defaultValues = {
  boolean: true,
  array: [],
  string: null,
  object: null,
};

export function getDefault(option) {
  return option.default === undefined
    ? defaultValues[option.type]
    : option.default;
}

export function getConfig() {
  const options = getOptions();
  const config = {};
  options.forEach(option => {
    if (!option.parent) {
      config[option.name] = getDefault(option);
    }
  });
  return config;
}
