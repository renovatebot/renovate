import { type AST, getStaticTOMLValue, parseTOML } from 'toml-eslint-parser';
import { regEx } from './regex.ts';
import { stripTemplates } from './string.ts';

export function parseTOMLDocument(input: string): AST.TOMLProgram {
  return parseTOML(input, { tomlVersion: '1.1' });
}

export function parse(input: string): unknown {
  return getStaticTOMLValue(parseTOMLDocument(input));
}

export function massage(input: string): string {
  return massageWithSourceMap(input).content;
}

export function massageWithSourceMap(input: string): {
  content: string;
  toOriginalOffset: (offset: number) => number;
} {
  const keys: [number, number][] = [];
  const templates: [number, number][] = [];
  const withoutKeys = input.replace(
    regEx(/^\s*{{.+?}}\s*=.*$/gm),
    (match, offset: number) => {
      keys.push([offset, offset + match.length]);
      return '';
    },
  );
  const content = stripTemplates(withoutKeys, (start, end) => {
    templates.push([start, end]);
  });

  return {
    content,
    toOriginalOffset: (offset) =>
      restoreOffset(restoreOffset(offset, templates), keys),
  };
}

function restoreOffset(offset: number, removed: [number, number][]): number {
  let result = offset;
  for (const [start, end] of removed) {
    if (result < start) {
      break;
    }
    result += end - start;
  }
  return result;
}
