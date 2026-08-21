import { type AST, getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { regEx } from './regex.ts';
import { stripTemplates } from './string.ts';

export function parseTOMLDocument(input: string): AST.TOMLProgram {
  return parseTOML(input, { tomlVersion: '1.1' });
}

export function parse(input: string): unknown {
  const ast = parseTOML(input, { tomlVersion: '1.1' });
  return getStaticTOMLValue(ast);
}

export function massage(input: string): string {
  return stripTemplates(input.replace(regEx(/^\s*{{.+?}}\s*=.*$/gm), ''));
}
