import { Scalar } from 'yaml';
import { getScalarQuote, parseRefComment } from './parse.ts';

describe('modules/manager/gitlabci-include/parse', () => {
  describe('parseRefComment()', () => {
    it.each`
      comment                      | expected
      ${' v2.0.0'}                 | ${{ ref: 'v2.0.0', matchedString: ' v2.0.0' }}
      ${' 1.0.0'}                  | ${{ ref: '1.0.0', matchedString: ' 1.0.0' }}
      ${' 1.0'}                    | ${{ ref: '1.0', matchedString: ' 1.0' }}
      ${' v2'}                     | ${{ ref: 'v2', matchedString: ' v2' }}
      ${' v2.0.0-rc.1'}            | ${{ ref: 'v2.0.0-rc.1', matchedString: ' v2.0.0-rc.1' }}
      ${' prefix/v1.2.3'}          | ${{ ref: 'prefix/v1.2.3', matchedString: ' prefix/v1.2.3' }}
      ${' prefix-1.2.3'}           | ${{ ref: 'prefix-1.2.3', matchedString: ' prefix-1.2.3' }}
      ${' tag=v2.0.0'}             | ${{ ref: 'v2.0.0', matchedString: ' tag=v2.0.0' }}
      ${' renovate: pin v2.0.0'}   | ${{ ref: 'v2.0.0', matchedString: ' renovate: pin v2.0.0' }}
      ${' v2.0.0 # keep me'}       | ${{ ref: 'v2.0.0', matchedString: ' v2.0.0' }}
      ${' v2.0.0 extra note'}      | ${{ ref: 'v2.0.0', matchedString: ' v2.0.0' }}
      ${' main'}                   | ${{ ref: 'main', matchedString: ' main' }}
      ${' release/2.x'}            | ${{ ref: 'release/2.x', matchedString: ' release/2.x' }}
      ${' main # Unpinned branch'} | ${{ ref: 'main', matchedString: ' main' }}
      ${' ~latest'}                | ${{ ref: '~latest', matchedString: ' ~latest' }}
      ${' pinned for security'}    | ${null}
      ${' # nested comment only'}  | ${null}
      ${'   '}                     | ${null}
      ${''}                        | ${null}
    `('parses "$comment"', ({ comment, expected }) => {
      expect(parseRefComment(comment)).toEqual(expected);
    });
  });

  describe('getScalarQuote()', () => {
    it.each`
      type               | expected
      ${'QUOTE_DOUBLE'}  | ${'"'}
      ${'QUOTE_SINGLE'}  | ${"'"}
      ${'PLAIN'}         | ${''}
      ${'BLOCK_LITERAL'} | ${null}
      ${'BLOCK_FOLDED'}  | ${null}
      ${undefined}       | ${null}
    `('returns $expected for $type', ({ type, expected }) => {
      const scalar = new Scalar('v1.0.0');
      scalar.type = type;

      expect(getScalarQuote(scalar)).toBe(expected);
    });
  });
});
