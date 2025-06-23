import { CustomCommitMessage } from './custom-commit-message';

describe('workers/repository/model/custom-commit-message', () => {
  describe('CustomCommitMessage', () => {
    it.each`
      subject                                      | prefix             | result
      ${'test'}                                    | ${''}              | ${'Test'}
      ${'  test  '}                                | ${'  '}            | ${'Test'}
      ${'test'}                                    | ${'fix'}           | ${'fix: test'}
      ${'test'}                                    | ${'fix:'}          | ${'fix: test'}
      ${'Message    With   Extra  Whitespaces   '} | ${'  refactor   '} | ${'refactor: message With Extra Whitespaces'}
    `(
      'given subject $subject and prefix $prefix as arguments, returns $result',
      ({
        subject,
        prefix,
        result,
      }: {
        subject: string;
        prefix: string;
        result: string;
      }) => {
        const commitMessage = new CustomCommitMessage();
        commitMessage.subject = subject;
        commitMessage.prefix = prefix;

        expect(commitMessage.toString()).toEqual(result);
      },
    );

    it('should provide ability to set body and footer', () => {
      const commitMessage = new CustomCommitMessage();
      commitMessage.subject = 'subject';
      commitMessage.body = 'body';
      commitMessage.footer = 'footer';

      expect(commitMessage.toJSON()).toEqual({
        body: 'body',
        footer: 'footer',
        prefix: '',
        subject: 'subject',
      });
      expect(commitMessage.toString()).toBe('Subject\n\nbody\n\nfooter');
    });

    it('should remove empty subject by default', () => {
      const commitMessage = new CustomCommitMessage();

      expect(commitMessage.formatSubject()).toBe('');
    });
  });
});
