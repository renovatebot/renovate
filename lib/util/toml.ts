import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import type { JsonValue } from 'type-fest';

export function parse(input: string): unknown {
  const ast = parseTOML(input);
  return getStaticTOMLValue(ast) as JsonValue;
}
