import { codeBlock } from 'common-tags';
import { Fixtures } from '../../test/fixtures';
import { linkify, sanitizeMarkdown } from './markdown';

describe('util/markdown', () => {
  describe('.linkify', () => {
    const before = codeBlock`
      Some references:

      *   Commit: f8083175fe890cbf14f41d0a06e7aa35d4989587
      *   Commit (fork): foo@f8083175fe890cbf14f41d0a06e7aa35d4989587
      *   Commit (repo): remarkjs/remark@e1aa9f6c02de18b9459b7d269712bcb50183ce89
      *   Issue or PR (\`#\`): #1
      *   Issue or PR (\`GH-\`): GH-1
      *   Issue or PR (fork): foo#1
      *   Issue or PR (project): remarkjs/remark#1
      *   Mention: @wooorm
    `;

    const after =
      codeBlock`
        Some references:

        -   Commit: [\`f808317\`](https://github.com/some/repo/commit/f8083175fe890cbf14f41d0a06e7aa35d4989587)
        -   Commit (fork): [foo@\`f808317\`](https://github.com/foo/repo/commit/f8083175fe890cbf14f41d0a06e7aa35d4989587)
        -   Commit (repo): [remarkjs/remark@\`e1aa9f6\`](https://github.com/remarkjs/remark/commit/e1aa9f6c02de18b9459b7d269712bcb50183ce89)
        -   Issue or PR (\`#\`): [#1](https://github.com/some/repo/issues/1)
        -   Issue or PR (\`GH-\`): [GH-1](https://github.com/some/repo/issues/1)
        -   Issue or PR (fork): [foo#1](https://github.com/foo/repo/issues/1)
        -   Issue or PR (project): [remarkjs/remark#1](https://github.com/remarkjs/remark/issues/1)
        -   Mention: [@wooorm](https://github.com/wooorm)
    ` + '\n';

    it('works', async () => {
      const res = await linkify(before, { repository: 'some/repo' });
      expect(res).toEqual(after);
    });

    it('sanitizeMarkdown check massaged release notes', () => {
      const input =
        '#### Our Gold Sponsors\n' +
        '\n' +
        '<table>\n' +
        '</table>\n' +
        '#### Our Silver Sponsors\n' +
        '\n' +
        '<table>\n' +
        '</table>\n' +
        "#### What's Changed\n" +
        '* pnpm rebuild accepts --store-dir by @user in https://github.com/foo/foo/pull/1\n' +
        '\n' +
        '#### New Contributors\n' +
        '* @user made their first contribution in https://github.com/foo/foo/pull/2\n' +
        '#### [Heading With Markdown Link](https://github.com/foo/foo/blob/HEAD/CHANGELOG.md#1234-2023-07-03)' +
        '\n' +
        '* link to GH issue [#1234](https://github.com/some/repo/issues/1234)' +
        '\n';

      const expected = Fixtures.get('release-notes.txt');
      expect(sanitizeMarkdown(input)).toEqual(expected);
    });
  });
});
