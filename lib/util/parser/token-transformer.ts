import is from '@sindresorhus/is';
import type { Token } from './token';
import { Tokenizer } from './tokenizer';

export type TransformerOutputFn = (...tokens: Token[]) => void;

export interface TokenTransformer<State extends Record<string, any>> {
  begin?(): State;
  transform(input: Token, output: TransformerOutputFn, state: State): State;
  end?(state: State, output: TransformerOutputFn): void;
}

export function transformTokenizer<T extends Record<string, any>>(
  tokenizer: Tokenizer,
  transformer: TokenTransformer<T>
): Tokenizer {
  let state: T = transformer?.begin() || ({} as T);

  const outputs: Token[] = [];
  const output = (...tokens: Token[]): void => {
    outputs.push(...tokens);
  };

  const iter = tokenizer[Symbol.iterator]();

  let done = false;
  const next = (): { done: boolean; value: Token } => {
    if (outputs.length) {
      return { done: false, value: outputs.shift() };
    }

    if (done) {
      return { done, value: undefined };
    }

    let item = iter.next();
    while (!item.done) {
      state = transformer.transform(item.value, output, state);
      if (outputs.length) {
        return { done: false, value: outputs.shift() };
      }
      item = iter.next();
    }

    done = true;

    transformer.end?.(state, output);
    if (outputs.length) {
      return { done: false, value: outputs.shift() };
    }

    return { done, value: undefined };
  };

  const iterator = { next };
  const result = {
    reset(input?: string) {
      if (is.nullOrUndefined(input)) {
        tokenizer.reset();
      } else {
        tokenizer.reset(input);
      }
      return result;
    },
    [Symbol.iterator]: () => iterator,
  };

  return result;
}

export interface PrevTokenState {
  prevToken: Token;
}
