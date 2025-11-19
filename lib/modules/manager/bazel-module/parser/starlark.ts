import { isBoolean } from '@sindresorhus/is';

const stringMapping: ReadonlyMap<string, boolean> = new Map<string, boolean>([
  ['True', true],
  ['False', false],
]);

export const booleanStringValues = Array.from(stringMapping.keys());

export function asBoolean(value: string): boolean {
  const result = stringMapping.get(value);
  if (isBoolean(result)) {
    return result;
  }
  throw new Error(`Invalid Starlark boolean string: ${value}`);
}
