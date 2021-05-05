import moo from 'moo';
import { getName, loadFixture } from '../../../test/util';
import { buildRules } from './tokenizer';
import type { Token, TokenType, TokenizerOptions } from './types';
import { TokenType as t } from './types';

function lex(input: string, opts?: TokenizerOptions): Token[] {
  const rules = buildRules(opts);
  const lexer = moo.states(rules);
  lexer.reset(input);
  const result = [...lexer].map(
    ({ type, value, offset }) =>
      ({
        type,
        value,
        offset,
      } as Token)
  );
  return result;
}

function lexTypes(input: string, opts?: TokenizerOptions): TokenType[] {
  return lex(input, opts).map(({ type }) => type);
}

const cLike: TokenizerOptions = {
  lineCommentStart: '//',
  multiLineCommentStart: '/*',
  multiLineCommentFinish: '*/',
};

describe(getName(), () => {
  it('spaces', () => {
    expect(lexTypes('  \t\t\n\r\n')).toEqual([
      t.Space,
      t.Space,
      t.Tab,
      t.Tab,
      t.Newline,
      t.Newline,
    ]);
  });

  it('comments', () => {
    const input = loadFixture('comments.txt');
    expect(lexTypes(input, cLike)).toEqual([
      t.LineComment,
      t.Newline,
      t.LineComment,
      t.Newline,
      t.MultiLineComment,
      t.Newline,
    ]);
  });

  it('symbols', () => {
    const input = `foo_bar012`;
    expect(lex(input)).toEqual([
      {
        type: t.Symbol,
        value: input,
        offset: 0,
      },
    ]);
  });

  // it('works', () => {
  //   const lexer = moo.states({
  //     main: {
  //       string: { match: /'''(?:(?!''').)*.?'''/ },
  //       unknown: { match: /[^]/, lineBreaks: true },
  //     },
  //   });
  //   lexer.reset(`''''''`);
  //   const result = Array.from(lexer);
  //   expect(result).toEqual([]);
  // });
});
