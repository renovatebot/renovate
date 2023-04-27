import is from '@sindresorhus/is';

// Filter out missing values in a typesafe manner.
// Inspired by https://stackoverflow.com/questions/43118692/typescript-filter-out-nulls-from-an-array
export function instanceExists<Value>(
  value: Value | null | undefined
): value is Value {
  if (is.falsy(value)) {
    return false;
  }
  const placeholder: Value = value;
  return is.truthy(placeholder);
}
