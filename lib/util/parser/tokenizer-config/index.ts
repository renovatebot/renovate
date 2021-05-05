import { fallback as fallbackRule } from 'moo';
import type { Rules as MooRules } from 'moo';
import { TokenType as t } from '../token';
import { commentRule } from './comment';
import type { CommentOption, TokenizerOptions } from './types';
import { ensureArray, ruleName, sortOptions } from './utils';

interface MooStates {
  [x: string]: MooRules;
}

export function buildRules(options: TokenizerOptions): MooStates {
  const comments = sortOptions(ensureArray<CommentOption>(options?.comments))
    .map(commentRule)
    .reduce((acc, rule, idx) => {
      const name = ruleName(t.Comment, idx);
      acc[name] = rule;
      return acc;
    }, {} as MooRules);

  const result: MooStates = {
    _: {
      ...comments,
      [t.Unknown]: fallbackRule,
    },
  };

  return result;
}
