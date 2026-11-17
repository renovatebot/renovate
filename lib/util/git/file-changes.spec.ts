import { fs, partial } from '~test/util.ts';
import { collectFileChanges } from './file-changes.ts';
import type { StatusResult } from './types.ts';

vi.mock('../fs/index.ts');

describe('util/git/file-changes', () => {
  beforeEach(() => {
    fs.readLocalFile.mockImplementation((file) =>
      Promise.resolve(`content of ${file}`),
    );
  });

  it('collects modified, not added and deleted files by default', async () => {
    const status = partial<StatusResult>({
      modified: ['modified.txt'],
      not_added: ['added.txt'],
      created: ['created.txt'],
      deleted: ['deleted.txt'],
    });

    await expect(collectFileChanges(status)).resolves.toEqual([
      {
        type: 'addition',
        path: 'modified.txt',
        contents: 'content of modified.txt',
      },
      {
        type: 'addition',
        path: 'added.txt',
        contents: 'content of added.txt',
      },
      { type: 'deletion', path: 'deleted.txt' },
    ]);
  });

  it('returns changes in the order of the included buckets', async () => {
    const status = partial<StatusResult>({
      modified: ['modified.txt'],
      created: ['created.txt'],
      conflicted: ['conflicted.txt'],
      deleted: ['deleted.txt'],
    });

    await expect(
      collectFileChanges(status, {
        include: ['deleted', 'conflicted', 'created'],
      }),
    ).resolves.toEqual([
      { type: 'deletion', path: 'deleted.txt' },
      {
        type: 'addition',
        path: 'conflicted.txt',
        contents: 'content of conflicted.txt',
      },
      {
        type: 'addition',
        path: 'created.txt',
        contents: 'content of created.txt',
      },
    ]);
  });

  it('turns renames into a deletion and an addition', async () => {
    const status = partial<StatusResult>({
      renamed: [{ from: 'old.txt', to: 'new.txt' }],
    });

    await expect(
      collectFileChanges(status, { include: ['renamed'] }),
    ).resolves.toEqual([
      { type: 'deletion', path: 'old.txt' },
      { type: 'addition', path: 'new.txt', contents: 'content of new.txt' },
    ]);
  });

  it('applies the filter to every bucket', async () => {
    const status = partial<StatusResult>({
      modified: ['sub/modified.txt', 'other/modified.txt'],
      deleted: ['sub/deleted.txt', 'other/deleted.txt'],
      renamed: [
        { from: 'other/old.txt', to: 'sub/new.txt' },
        { from: 'sub/old.txt', to: 'other/new.txt' },
      ],
    });

    await expect(
      collectFileChanges(status, {
        include: ['modified', 'deleted', 'renamed'],
        filter: (path) => path.startsWith('sub/'),
      }),
    ).resolves.toEqual([
      {
        type: 'addition',
        path: 'sub/modified.txt',
        contents: 'content of sub/modified.txt',
      },
      { type: 'deletion', path: 'sub/deleted.txt' },
      {
        type: 'addition',
        path: 'sub/new.txt',
        contents: 'content of sub/new.txt',
      },
      { type: 'deletion', path: 'sub/old.txt' },
    ]);
  });

  it('attaches addition metadata', async () => {
    const status = partial<StatusResult>({ not_added: ['bin/tool'] });

    await expect(
      collectFileChanges(status, {
        include: ['not_added'],
        additionMetadata: (path) =>
          Promise.resolve({ isExecutable: path.startsWith('bin/') }),
      }),
    ).resolves.toEqual([
      {
        type: 'addition',
        path: 'bin/tool',
        contents: 'content of bin/tool',
        isExecutable: true,
      },
    ]);
  });

  it('tolerates missing buckets', async () => {
    await expect(
      collectFileChanges(partial<StatusResult>({}), {
        include: ['modified', 'deleted', 'renamed'],
      }),
    ).resolves.toEqual([]);
  });
});
