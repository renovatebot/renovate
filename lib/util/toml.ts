import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { regEx } from './regex.ts';
import { stripTemplates } from './string.ts';

export function parse(input: string): unknown {
  const ast = parseTOML(input);
  return getStaticTOMLValue(ast);
}

export function massage(input: string): string {
  return stripTemplates(input.replace(regEx(/^\s*{{.+?}}\s*=.*$/gm), ''));
}
