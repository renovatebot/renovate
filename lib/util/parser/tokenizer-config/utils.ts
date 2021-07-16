import is from '@sindresorhus/is';
import { TokenType } from '../token';
import { OneOrMany, SortableOption } from './types';

export function ensureArray<T>(input?: OneOrMany<T>): T[] {
  if (is.nullOrUndefined(input)) {
    return [];
  }

  if (is.array<T>(input)) {
    return input;
  }

  return [input];
}

function compareOptions<T extends SortableOption>(
  { start: x }: T,
  { start: y }: T
): -1 | 0 | 1 {
  if (x.startsWith(y)) {
    return -1;
  }

  if (y.startsWith(x)) {
    return 1;
  }

  return 0;
}

export function sortOptions<T extends SortableOption>(options: T[]): T[] {
  if (options.length < 2) {
    return options;
  }

  const optionClasses = options.reduce((acc, option) => {
    acc[option.start] = [option];
    return acc;
  }, {});

  const keys = Object.keys(optionClasses);

  for (let i = 0; i < keys.length - 1; i += 1) {
    const xKey = keys[i];
    if (optionClasses[xKey].length) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const yKey = keys[j];
        if (optionClasses[yKey].length) {
          const [x] = optionClasses[xKey];
          const [y] = optionClasses[yKey];
          if (compareOptions(x, y) !== 0) {
            optionClasses[xKey] = [
              ...optionClasses[xKey],
              ...optionClasses[yKey],
            ].sort(compareOptions);
            optionClasses[yKey] = [];
          }
        }
      }
    }
  }

  return [].concat(...Object.values(optionClasses));
}

export function ruleName(
  type: TokenType,
  idx: number,
  suffix?: string
): string {
  const stateName = type + '$' + String(idx);
  return suffix ? stateName + '$' + suffix : stateName;
}
