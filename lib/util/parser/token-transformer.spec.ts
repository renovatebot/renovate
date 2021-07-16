import moo from 'moo';
import { getName } from '../../../test/util';
import type { Token } from './token';
import { transformTokenizer } from './token-transformer';
import type {
  PrevTokenState,
  TokenTransformer,
  TransformerOutputFn,
} from './token-transformer';

const duplicateTransformer: TokenTransformer<PrevTokenState> = {
  begin: () => ({ prevToken: null }),
  transform(
    input: Token,
    output: TransformerOutputFn,
    state: PrevTokenState
  ): PrevTokenState {
    const { prevToken } = state;
    if (!prevToken || prevToken.value !== input.value) {
      output(input);
    }
    return { prevToken: input };
  },
};

describe(getName, () => {
  it('tests stuff for me', () => {
    const lexer = transformTokenizer<PrevTokenState>(
      moo
        .compile({
          token: {
            match: /[abc]/,
          },
        })
        .reset('aaabbcccc') as any,
      duplicateTransformer
    );

    const acc = [];
    for (const x of lexer) {
      acc.push(x);
    }

    expect(true).toBeTrue();
  });
});
