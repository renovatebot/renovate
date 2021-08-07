import { getName } from '../../test/util';
import { linkify } from './markdown';

describe(getName(), () => {
  describe('.linkify', () => {
    const md = `Some references:

*   Commit: f8083175fe890cbf14f41d0a06e7aa35d4989587
*   Commit (fork): foo@f8083175fe890cbf14f41d0a06e7aa35d4989587
*   Commit (repo): remarkjs/remark@e1aa9f6c02de18b9459b7d269712bcb50183ce89
*   Issue or PR (\`#\`): #1
*   Issue or PR (\`GH-\`): GH-1
*   Issue or PR (fork): foo#1
*   Issue or PR (project): remarkjs/remark#1
*   Mention: @wooorm
`;
    it('works', async () => {
      expect(await linkify(md, { repository: 'some/repo' })).toMatchSnapshot();
    });
  });
});
