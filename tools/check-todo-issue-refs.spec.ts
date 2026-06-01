import {
  checkTodoIssueRefs,
  extractClosingIssueRefs,
  extractPullRequestTextFromGitHubEvent,
  parseTodoIssueRef,
} from './check-todo-issue-refs.ts';

describe('tools/check-todo-issue-refs', () => {
  it('extracts issue refs from closing keywords', () => {
    expect(
      extractClosingIssueRefs(
        'Fixes #123 and resolves renovatebot/renovate#456. Closes https://github.com/renovatebot/renovate/issues/789. Closes: #987',
      ),
    ).toEqual(new Set(['123', '456', '789', '987']));
  });

  it('ignores non-closing references', () => {
    expect(extractClosingIssueRefs('Related to #123')).toBeEmpty();
  });

  it('ignores closing references in inline code', () => {
    expect(
      extractClosingIssueRefs(
        "Validation used `RENOVATE_PR_TITLE='Closes: #22198'` as a negative case. Closes: #41497",
      ),
    ).toEqual(new Set(['41497']));
  });

  it('ignores closing references in fenced code blocks', () => {
    expect(
      extractClosingIssueRefs(
        [
          'Closes: #41497',
          '```sh',
          "RENOVATE_PR_TITLE='Closes: #22198'",
          '```',
        ].join('\n'),
      ),
    ).toEqual(new Set(['41497']));
  });

  it('extracts pull request text from the GitHub event payload', () => {
    expect(
      extractPullRequestTextFromGitHubEvent({
        pull_request: {
          title: 'Closes #123',
          body: 'Fixes #456',
        },
      }),
    ).toBe('Closes #123\nFixes #456');
  });

  it('parses git grep TODO output', () => {
    expect(parseTodoIssueRef('lib/foo.ts:42:// TODO remove this #123')).toEqual(
      {
        file: 'lib/foo.ts',
        line: 42,
        issue: '123',
        text: '// TODO remove this #123',
      },
    );
  });

  it('parses TODO refs from GitHub URLs', () => {
    expect(
      parseTodoIssueRef(
        'lib/foo.ts:42:// TODO remove once https://github.com/renovatebot/renovate/discussions/123 is resolved',
      ),
    ).toEqual({
      file: 'lib/foo.ts',
      line: 42,
      issue: '123',
      text: '// TODO remove once https://github.com/renovatebot/renovate/discussions/123 is resolved',
    });
  });

  it('finds TODOs matching issues closed by the PR', () => {
    const matches = checkTodoIssueRefs(
      'Closes #123',
      [
        'lib/foo.ts:10:// TODO remove when #123 is closed',
        'lib/bar.ts:20:// TODO unrelated #456',
      ].join('\n'),
    );

    expect(matches).toEqual([
      {
        file: 'lib/foo.ts',
        line: 10,
        issue: '123',
        text: '// TODO remove when #123 is closed',
      },
    ]);
  });

  it('does not report TODOs for unrelated closed issues', () => {
    expect(
      checkTodoIssueRefs('Closes #123', 'lib/bar.ts:20:// TODO unrelated #456'),
    ).toBeEmpty();
  });
});
