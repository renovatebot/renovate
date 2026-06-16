import { ContentsListResponse, Repo } from './schema.ts';

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
