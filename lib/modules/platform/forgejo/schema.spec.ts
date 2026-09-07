import { Issue, Repo, User } from './schema.ts';

describe('modules/platform/forgejo/schema', () => {
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
