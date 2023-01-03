/*
MIT License

Copyright (c) 2021 Sergei Zharinov

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
// https://github.com/zharinov/good-enough-parser/blob/main/lib/lang/scala.ts
import type {
  lang as language,
  lexer as lex,
  parser as p,
} from 'good-enough-parser';

const operators =
  /* prettier-ignore */ [
  '+', '-', '*', '/', '%', '%%', '%%%', '**', // added %%%
  '++', '--',
  '+=', '++=', '-=', '*=', '/=', '%=', '**=',
  '==', '!=', '<', '<=', '>', '>=', '===', '!==', '<=>',
  '&&', '||', '!',
  '&', '|', '^', '~',
  '<<', '>>', '>>>',
  '?', '?:',
  ':=', '=', '?=',
  '.', '?.', '.@', '.&', '::', ':::',
  '=~', '==~',
  '*.', ':',
  '..', '..<',
  '<>',
  '<<=', '>>=', '>>>=', '&=', '^=', '|=', '?=',
  '->',
  ',', ';',
];

const octdigit = '[0-7]';
const digit = '[0-9]';
const nonzerodigit = '[1-9]';
const hexdigit = `(?:${digit}|[a-fA-F])`;

const octinteger = `(?:0[oO](?:_?${octdigit})+)`;
const hexinteger = `(?:0[xX](?:_?${hexdigit})+)`;
const decinteger = `(?:${nonzerodigit}(?:_?${digit})*|0+(?:_?0)*)`;
const integer = `(?:${decinteger}|${octinteger}|${hexinteger})`;

const digitpart = `(?:${digit}(?:_?${digit})*)`;
const fraction = `(?:\\.${digitpart})`;
const exponent = `(?:[eE][-+]?${digitpart})`;
const pointfloat = `(?:${digitpart}?${fraction}|${digitpart}\\.)`;
const exponentfloat = `(?:(?:${digitpart}|${pointfloat})${exponent})`;
const floatnumber = `(?:${pointfloat}|${exponentfloat})`;

const numbers = new RegExp(`(?:${integer}|${floatnumber})`);

const templates: lex.TemplateOption[] = [
  {
    type: 'var',
    startsWith: '$',
    symbols: /[a-zA-Z_][a-zA-Z0-9_]+/,
  },
  { type: 'expr', startsWith: '${', endsWith: '}' },
];

export const lexer: lex.LexerConfig = {
  joinLines: '\\',
  comments: [
    { type: 'line-comment', startsWith: '//' },
    { type: 'multiline-comment', startsWith: '/*', endsWith: '*/' },
  ],
  symbols: /[_a-zA-Z][_a-zA-Z0-9]*/,
  numbers,
  operators,
  brackets: [
    { startsWith: '{', endsWith: '}' },
    { startsWith: '[', endsWith: ']' },
    { startsWith: '(', endsWith: ')' },
  ],
  strings: [
    { startsWith: '"' },
    { startsWith: 'raw"', endsWith: '"' },
    { startsWith: 's"', templates, endsWith: '"' },
    { startsWith: 'f"', templates, endsWith: '"' },
  ],
};

export const parser: p.ParserConfig = {
  useIndentBlocks: false,
};

export const lang: language.LanguageConfig = { lexer, parser };
