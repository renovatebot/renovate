import { CustomCommitMessage } from './custom-commit-message';

describe('workers/repository/model/custom-commit-message', () => {
  describe('CustomCommitMessage', () => {
    const TEST_CASES: ReadonlyArray<
      [message: string, prefix: string | undefined, result: string]
    > = [
      ['test', undefined, 'Test'],
      ['test', '', 'Test'],
      ['  test  ', '  ', 'Test'],
      ['test', 'fix', 'fix: test'],
      ['test', 'fix:', 'fix: test'],
      [
        'Message    With   Extra  Whitespaces   ',
        '  refactor   ',
        'refactor: message With Extra Whitespaces',
      ],
    ];

    it.each(TEST_CASES)(
      'given %p and %p as arguments, returns %p',
      (subject, prefix, result) => {
        const commitMessage = new CustomCommitMessage();
        commitMessage.setSubject(subject);
        commitMessage.setPrefix(prefix);

        expect(commitMessage.toString()).toEqual(result);
      }
    );

    it('should provide ability to set body and footer', () => {
      const commitMessage = new CustomCommitMessage();
      commitMessage.setSubject('subject');
      commitMessage.setBody('body');
      commitMessage.setFooter('footer');

      expect(commitMessage.toString()).toBe('Subject\n\nbody\n\nfooter');
    });
  });
});
