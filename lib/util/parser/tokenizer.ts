import is from '@sindresorhus/is';
import moo from 'moo';
import { Token, massageMooToken } from './token';
import { buildRules } from './tokenizer-config';
import type { TokenizerOptions } from './tokenizer-config/types';

export interface Tokenizer {
  reset(input?: string): Tokenizer;
  [Symbol.iterator](): Iterator<Token>;
}

export function createTokenizer(options: TokenizerOptions): Tokenizer {
  const rules = buildRules(options);
  const mooTokenizer = moo.states(rules);

  const result = {
    reset(input?: string) {
      if (is.nullOrUndefined(input)) {
        mooTokenizer.reset();
      } else {
        mooTokenizer.reset(input);
      }
      return result;
    },
    [Symbol.iterator]() {
      const mooIter = mooTokenizer[Symbol.iterator]();
      const next = (): { done: boolean; value: Token } => {
        const { done, value } = mooIter.next();
        return done
          ? { done, value: undefined }
          : { done, value: massageMooToken(value) };
      };
      return { next };
    },
  };

  return result;
}
