import type { lexer as l, parser as p } from '@renovatebot/good-enough-parser';
import { lang } from '@renovatebot/good-enough-parser';

const lexer: l.LexerConfig = {
  joinLines: null,
  comments: [
    { type: 'line-comment', startsWith: '//' },
    { type: 'multiline-comment', startsWith: '/*', endsWith: '*/' },
  ],
  symbols: /[_a-zA-Z][_a-zA-Z0-9]*/,
  // `numbers` is not necessary for parsing Package.swift, so we use a minimal
  // regular expression here; numeric tokens are not handled strictly during parsing.
  numbers: /[0-9]+/,
  operators: [',', '.', ':', '...', '..<'],
  brackets: [
    { startsWith: '{', endsWith: '}' },
    { startsWith: '(', endsWith: ')' },
    { startsWith: '[', endsWith: ']' },
  ],
  strings: [{ startsWith: '"' }, { startsWith: '"""' }],
};

const parser: p.ParserConfig = {
  useIndentBlocks: false,
};

export const packageSwift = lang.createLang({ lexer, parser });
