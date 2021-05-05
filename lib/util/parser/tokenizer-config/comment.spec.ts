import moo from 'moo';
import type { Rule as MooRule } from 'moo';
import { getName } from '../../../../test/util';
import { commentRule } from './comment';

describe(getName(), () => {
  let rule: MooRule;

  function ruleMatches(input: string): boolean {
    const lexer = moo.compile({ token: rule }).reset(input);
    return [...lexer].length === 1;
  }

  beforeEach(() => {
    rule = null;
  });

  describe('comments', () => {
    it('handles line comments', () => {
      rule = commentRule({ start: '#' });
      expect(ruleMatches('# foobar')).toBeTrue();
      expect(ruleMatches('###')).toBeTrue();
    });

    it('handles closing comments', () => {
      rule = commentRule({ start: '(*', finish: '*)' });
      expect(ruleMatches('(* foobar *)')).toBeTrue();
    });

    it('handles multi-line comments', () => {
      rule = commentRule({ start: '/*', finish: '*/' });
      expect(ruleMatches('/* foo \n\n\n bar */')).toBeTrue();
    });
  });
});
