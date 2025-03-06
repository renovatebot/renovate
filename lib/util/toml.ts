import { getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { regEx } from './regex';
import { stripTemplates } from './string';

export function parse(input: string): unknown {
  const ast = parseTOML(input);
  return getStaticTOMLValue(ast);
}

export function massage(input: string): string {
  return stripTemplates(input.replace(regEx(/^\s*{{.+?}}\s*=.*$/gm), ''));
}
