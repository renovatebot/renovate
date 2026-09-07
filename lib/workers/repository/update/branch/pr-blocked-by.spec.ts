import { logger } from '../../../../logger/index.ts';
import type { BranchResult, PrBlockedBy } from '../../../types.ts';
import { prBlockedByToResult } from './pr-blocked-by.ts';

describe('workers/repository/update/branch/pr-blocked-by', () => {
  describe('prBlockedByToResult', () => {
    it.each`
      prBlockedBy          | expected
      ${'RateLimited'}     | ${'pr-limit-reached'}
      ${'NeedsApproval'}   | ${'needs-pr-approval'}
      ${'AwaitingTests'}   | ${'pending'}
      ${'BranchAutomerge'} | ${'done'}
      ${'Error'}           | ${'error'}
    `(
      'maps $prBlockedBy to $expected',
      ({
        prBlockedBy,
        expected,
      }: {
        prBlockedBy: PrBlockedBy;
        expected: BranchResult;
      }) => {
        expect(prBlockedByToResult(prBlockedBy, false)).toBe(expected);
      },
    );

    it('warns for a rate-limited vulnerability alert', () => {
      expect(prBlockedByToResult('RateLimited', true)).toBe('error');
      expect(logger.warn).toHaveBeenCalledWith(
        { prBlockedBy: 'RateLimited' },
        'Unknown PrBlockedBy result',
      );
    });
  });
});
