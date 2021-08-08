import { getName } from '../../../../test/util';
import { CommitMessage } from './commit-message';

describe(getName(), () => {
  describe('CommitMessage', () => {
    const TEST_CASES: ReadonlyArray<
      [message: string, prefix: string, result: string]
    > = [
      ['test', '', 'Test'],
      ['  test  ', '  ', 'Test'],
      ['test', 'fix', 'fix: test'],
      ['test', 'fix(test)', 'fix(test): test'],
      ['test', 'feat(test):', 'feat(test): test'],
    ];

    it('has colon character separator', () => {
      expect(CommitMessage.SEPARATOR).toBe(':');
    });

    it.each(TEST_CASES)(
      'given %p and %p as arguments, returns %p',
      (message, prefix, result) => {
        const commitMessage = new CommitMessage(message, prefix);

        expect(commitMessage.toString()).toEqual(result);
      }
    );
  });
});
