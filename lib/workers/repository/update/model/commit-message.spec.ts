import { CommitMessage } from './commit-message';

describe('workers/repository/update/model/commit-message', () => {
  describe('CommitMessage', () => {
    const TEST_CASES: ReadonlyArray<
      [message: string, prefix: string | undefined, result: string]
    > = [
      ['test', undefined, 'Test'],
      ['test', '', 'Test'],
      ['  test  ', '  ', 'Test'],
      ['test', 'fix', 'fix: test'],
      ['test', 'fix:', 'fix: test'],
    ];

    it('has colon character separator', () => {
      expect(CommitMessage.SEPARATOR).toBe(':');
    });

    it.each(TEST_CASES)(
      'given %p and %p as arguments, returns %p',
      (message, prefix, result) => {
        const commitMessage = new CommitMessage(message);
        commitMessage.setCustomPrefix(prefix);

        expect(commitMessage.toString()).toEqual(result);
      }
    );

    it('should handle not defined semantic prefix', () => {
      const message = new CommitMessage('test');
      message.setSemanticPrefix();

      expect(message.toString()).toBe('Test');
    });

    it('should handle empty semantic prefix', () => {
      const message = new CommitMessage('test');
      message.setSemanticPrefix('  ', '  ');

      expect(message.toString()).toBe('Test');
    });

    it('should format sematic prefix', () => {
      const message = new CommitMessage('test');
      message.setSemanticPrefix(' fix ');

      expect(message.toString()).toBe('fix: test');
    });

    it('should format sematic prefix with scope', () => {
      const message = new CommitMessage('test');
      message.setSemanticPrefix(' fix ', ' scope ');

      expect(message.toString()).toBe('fix(scope): test');
    });
  });
});
