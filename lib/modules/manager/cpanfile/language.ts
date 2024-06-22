import { lexer as l, lang, parser as p } from 'good-enough-parser';

/**
 * @see https://perldoc.perl.org/perldata#Scalar-value-constructors
 */
const bindigit = '[01]';
const octdigit = '[0-7]';
const digit = '[0-9]';
const nonzerodigit = '[1-9]';
const hexdigit = `(?:${digit}|[a-fA-F])`;

const bininteger = `(?:0[bB](?:_?${bindigit})+)`;
const octinteger = `(?:0(?:_?${octdigit})+)`;
const hexinteger = `(?:0[xX](?:_?${hexdigit})+)`;
const decinteger = `(?:${nonzerodigit}(?:_?${digit})*|0+(?:_?0)*)`;
const integer = `(?:${decinteger}|${bininteger}|${octinteger}|${hexinteger})`;

const digitpart = `(?:${digit}(?:_?${digit})*)`;
const fraction = `(?:\\.${digitpart})`;
const exponent = `(?:[eE][-+]?${digitpart})`;
const pointfloat = `(?:${digitpart}?${fraction}|${digitpart}\\.)`;
const exponentfloat = `(?:(?:${digitpart}|${pointfloat})${exponent})`;
const floatnumber = `(?:${pointfloat}|${exponentfloat})`;

const numbers = new RegExp(`(?:${floatnumber}|${integer})`);

const lexer: l.LexerConfig = {
  joinLines: null,
  comments: [{ type: 'line-comment', startsWith: '#' }],
  symbols: /[_a-zA-Z][_a-zA-Z0-9]*/,
  numbers,
  operators: ['==', '>=', '>', '=>', ',', ';'],
  brackets: [
    { startsWith: '{', endsWith: '}' },
    { startsWith: '(', endsWith: ')' },
  ],
  strings: [{ startsWith: "'" }, { startsWith: '"' }],
};

const parser: p.ParserConfig = {
  useIndentBlocks: false,
};

export const cpanfile = lang.createLang({ lexer, parser });
