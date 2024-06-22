import is from '@sindresorhus/is';
import JSON5 from 'json5';

export const coersions: Record<string, (arg: string) => unknown> = {
  boolean: (val: string): boolean => {
    if (val === 'true' || val === '') {
      return true;
    }
    if (val === 'false') {
      return false;
    }
    throw new Error(
      "Invalid boolean value: expected 'true' or 'false', but got '" +
        val +
        "'",
    );
  },
  array: (val: string): string[] => {
    if (val === '') {
      return [];
    }
    try {
      return JSON5.parse(val);
    } catch (err) {
      return val
        .split(',')
        .map((el) => el.trim())
        .filter(is.nonEmptyString);
    }
  },
  object: (val: string): any => {
    if (val === '') {
      return {};
    }
    try {
      return JSON5.parse(val);
    } catch (err) {
      throw new Error("Invalid JSON value: '" + val + "'");
    }
  },
  string: (val: string): string => val.replace(/\\n/g, '\n'),
  integer: parseInt,
};
