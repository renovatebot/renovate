import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { regEx } from './regex.ts';
import { stripTemplates } from './string.ts';

export function parse(input: string): unknown {
  // toml-eslint-parser v4 parses as toml v1.1
  const ast = parseTOML(input, { tomlVersion: '1.0' });
  return getStaticTOMLValue(ast);
}

export function massage(input: string): string {
  return stripTemplates(input.replace(regEx(/^\s*{{.+?}}\s*=.*$/gm), ''));
}
