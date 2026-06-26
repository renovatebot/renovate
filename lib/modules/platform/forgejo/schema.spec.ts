import { ContentsListResponse, Issue, Repo, User } from './schema.ts';

describe('modules/platform/forgejo/schema', () => {
  it('ContentsListResponse', () => {
    expect(ContentsListResponse.parse([])).toBeEmptyArray();
  });

  it('ContentsListResponse accepts symlink and submodule entries', () => {
    const entries = [
      { name: 'file.md', path: 'file.md', type: 'file', content: '' },
      { name: 'docs', path: 'docs', type: 'dir', content: null },
      { name: 'link', path: 'link', type: 'symlink', content: null },
      { name: 'sub', path: 'sub', type: 'submodule', content: null },
    ];
    const result = ContentsListResponse.parse(entries);
    expect(result).toHaveLength(4);
    expect(result.map((e) => e.type)).toEqual([
      'file',
      'dir',
      'symlink',
      'submodule',
    ]);
  });

  it('Issue tolerates null assignees and labels', () => {
    const issue = Issue.parse({
      number: 1,
      title: 't',
      body: 'b',
      assignees: null,
      labels: null,
    });
    expect(issue.assignees).toBeUndefined();
    expect(issue.labels).toBeUndefined();
  });

  it('User degrades empty email string to undefined', () => {
    const user = User.parse({
      id: 1,
      email: '',
      login: 'user',
    });
    expect(user.email).toBeUndefined();
  });

  it('User forwards GitHub app style email addresses', () => {
    const user = User.parse({
      id: 1,
      email: '211370388+foo[bot]@users.noreply.github.com',
      login: 'user',
    });
    expect(user.email).toBe('211370388+foo[bot]@users.noreply.github.com');
  });

  it('User keeps a valid email address', () => {
    const user = User.parse({
      id: 1,
      email: 'user@example.com',
      login: 'user',
    });
    expect(user.email).toBe('user@example.com');
  });

  it('Repo degrades unrecognized default_merge_style to undefined', () => {
    const repo = Repo.parse({
      id: 1,
      full_name: 'some/repo',
      default_branch: 'main',
      default_merge_style: 'manually-merged',
      owner: { id: 1, full_name: '', login: 'user' },
      permissions: { admin: false, pull: true, push: true },
    });
    expect(repo.default_merge_style).toBeUndefined();
  });
});
