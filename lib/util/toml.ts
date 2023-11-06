import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';

export function parse(input: string): unknown {
  const ast = parseTOML(input);
  return getStaticTOMLValue(ast);
}
