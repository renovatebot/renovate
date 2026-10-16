import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import * as _datasource from '../../datasource/index.ts';
import type { UpdateArtifactsConfig } from '../types.ts';
import { updateArtifacts } from './lock.ts';

vi.mock('../../../util/fs/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../util/fs/index.ts')>()),
  readLocalFile: vi.fn(),
  localPathExists: vi.fn(),
  writeLocalFile: vi.fn(),
}));
vi.mock('../../datasource/index.ts');

const datasource = vi.mocked(_datasource);

const config: UpdateArtifactsConfig = {
  isLockFileMaintenance: true,
  lockFiles: ['kas.lock.yml'],
};

let files: Record<string, string>;

const baseFiles: Record<string, string> = {
  'kas.yml': codeBlock`
    header:
      version: 22
      includes:
        - inc.yml
    repos:
      isar:
        url: https://github.com/ilbers/isar.git
        branch: next
      pinned:
        url: https://example.com/p.git
        branch: main
        commit: cccc
      nourl:
        branch: main
      hg:
        type: hg
        url: https://example.com/hg
        branch: default
      noref:
        url: https://example.com/noref.git
  `,
  'inc.yml': codeBlock`
    header:
      version: 22
    repos:
      other:
        url: https://example.com/other.git
        tag: v1
  `,
  'inc.lock.yml': codeBlock`
    header:
      version: 12
    overrides:
      repos:
        other:
          commit: old1 # keep me
  `,
};

function run(
  packageFileName = 'kas.yml',
  cfg: UpdateArtifactsConfig = config,
): ReturnType<typeof updateArtifacts> {
  return updateArtifacts({
    packageFileName,
    updatedDeps: [],
    newPackageFileContent: '',
    config: cfg,
  });
}

describe('modules/manager/kas/lock', () => {
  beforeEach(() => {
    files = { ...baseFiles };
    fs.readLocalFile.mockImplementation((p) =>
      Promise.resolve(files[p] ?? null),
    );
    fs.localPathExists.mockImplementation((p) => Promise.resolve(p in files));
    datasource.getDigest.mockImplementation((_c, ref) =>
      Promise.resolve({ next: 'new-isar', v1: 'new-other' }[ref ?? ''] ?? null),
    );
  });

  it('returns null unless lock file maintenance', async () => {
    await expect(run('kas.yml', {})).resolves.toBeNull();
  });

  it('returns null for non-entry files', async () => {
    await expect(
      run('inc.yml', { isLockFileMaintenance: true }),
    ).resolves.toBeNull();
    await expect(
      run('kas.yml', { isLockFileMaintenance: true, lockFiles: [] }),
    ).resolves.toBeNull();
    await expect(
      run('kas.conf', { isLockFileMaintenance: true, lockFiles: ['x'] }),
    ).resolves.toBeNull();
  });

  it('returns null when includes from other repos exist', async () => {
    files['kas.yml'] = files['kas.yml'].replace(
      '- inc.yml',
      '- inc.yml\n    - { repo: meta, file: x.yml }',
    );
    await expect(run()).resolves.toBeNull();
    expect(datasource.getDigest).not.toHaveBeenCalled();
  });

  it('returns null when root cannot be loaded', async () => {
    await expect(run('sub/kas.yml')).resolves.toBeNull();
  });

  it('updates existing lock, bumps header, creates top lockfile for uncovered repos', async () => {
    const res = await run();
    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'inc.lock.yml',
          contents: codeBlock`
            header:
              version: 14
            overrides:
              repos:
                other:
                  commit: new-other # keep me
          `.concat('\n'),
        },
      },
      {
        file: {
          type: 'addition',
          path: 'kas.lock.yml',
          contents: codeBlock`
            header:
              version: 14
            overrides:
              repos:
                isar:
                  commit: new-isar
          `.concat('\n'),
        },
      },
    ]);
    expect(datasource.getDigest).toHaveBeenCalledWith(
      {
        datasource: 'git-refs',
        packageName: 'https://github.com/ilbers/isar.git',
      },
      'next',
    );
    expect(datasource.getDigest).toHaveBeenCalledWith(
      { datasource: 'git-refs', packageName: 'https://example.com/other.git' },
      'v1',
    );
    expect(datasource.getDigest).toHaveBeenCalledTimes(2);
    expect(fs.writeLocalFile).toHaveBeenCalledTimes(2);
    expect(fs.writeLocalFile).toHaveBeenCalledWith(
      'kas.lock.yml',
      expect.stringContaining('commit: new-isar'),
    );
  });

  it('applies defaults.repos and treats overrides in project files as pinned', async () => {
    files = {
      'kas.yml': codeBlock`
        header:
          version: 22
        defaults:
          repos:
            branch: scarthgap
        repos:
          isar:
            url: https://github.com/ilbers/isar.git
          nobranch:
            url: https://example.com/nobranch.git
            branch: null
          other:
            url: https://example.com/other.git
            tag: v1
          overridden:
            url: https://example.com/o.git
            branch: main
        overrides:
          repos:
            overridden:
              commit: pinned
      `,
    };
    datasource.getDigest.mockResolvedValue('sha');
    const res = await run();
    expect(datasource.getDigest.mock.calls.map((c) => c[1])).toEqual([
      'scarthgap',
      'v1',
    ]);
    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'kas.lock.yml',
          contents: codeBlock`
            header:
              version: 14
            overrides:
              repos:
                isar:
                  commit: sha
                other:
                  commit: sha
          `.concat('\n'),
        },
      },
    ]);
  });

  it('skips repos whose ref lookup throws', async () => {
    // `other` (from inc.yml) is merged first and therefore resolved first
    datasource.getDigest.mockRejectedValueOnce(new Error('auth'));
    const res = await run();
    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'kas.lock.yml',
          contents: expect.not.stringContaining('other'),
        },
      },
    ]);
  });

  it('handles a lockfile reached twice via duplicate includes', async () => {
    files['kas.yml'] = files['kas.yml'].replace(
      '- inc.yml',
      '- inc.yml\n    - inc.yml',
    );
    const res = await run();
    expect(res?.map((r) => r.file?.path)).toEqual([
      'inc.lock.yml',
      'kas.lock.yml',
    ]);
  });

  it('adds new locks to existing top lockfile, keeps up-to-date entries', async () => {
    files['kas.lock.yml'] = codeBlock`
      # top
      header:
        version: 14
      overrides:
        repos:
          isar:
            commit: stale
    `;
    files['inc.lock.yml'] = files['inc.lock.yml']
      .replace('old1', 'new-other')
      .replace('version: 12', 'version: 14');
    const res = await run();
    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'kas.lock.yml',
          contents: codeBlock`
            # top
            header:
              version: 14
            overrides:
              repos:
                isar:
                  commit: new-isar
          `.concat('\n'),
        },
      },
    ]);
  });

  it('returns null when all locks are up to date', async () => {
    files['kas.lock.yml'] = codeBlock`
      header:
        version: 14
      overrides:
        repos:
          isar:
            commit: new-isar
    `;
    files['inc.lock.yml'] = files['inc.lock.yml']
      .replace('old1', 'new-other')
      .replace('version: 12', 'version: 14');
    await expect(run()).resolves.toBeNull();
  });

  it('returns null when nothing is floating', async () => {
    files = {
      'kas.yml': codeBlock`
        header:
          version: 22
        repos:
          pinned:
            url: https://example.com/p.git
            commit: cccc
      `,
    };
    await expect(run()).resolves.toBeNull();
    expect(datasource.getDigest).not.toHaveBeenCalled();
  });

  it('skips repos whose ref cannot be resolved', async () => {
    datasource.getDigest.mockResolvedValue(null);
    await expect(run()).resolves.toBeNull();
  });

  it('first lockfile locking a repo wins', async () => {
    files['kas.lock.yml'] = codeBlock`
      header:
        version: 14
      overrides:
        repos:
          other:
            commit: stale
    `;
    const res = await run();
    // inc.lock.yml keeps its stale entry: `other` was handled by kas.lock.yml
    expect(res).toMatchObject([
      {
        file: {
          path: 'kas.lock.yml',
          contents: expect.stringContaining('commit: new-other'),
        },
      },
    ]);
    expect(res).toMatchObject([
      { file: { contents: expect.stringContaining('commit: new-isar') } },
    ]);
  });

  it('handles json files', async () => {
    files = {
      'kas.json': JSON.stringify({
        header: { version: 22 },
        repos: { isar: { url: 'u', branch: 'next' } },
      }),
    };
    const res = await run('kas.json');
    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'kas.lock.json',
          contents: `${JSON.stringify(
            {
              header: { version: 14 },
              overrides: { repos: { isar: { commit: 'new-isar' } } },
            },
            null,
            2,
          )}\n`,
        },
      },
    ]);
  });

  it('updates existing json lockfile in place', async () => {
    files = {
      'kas.json': JSON.stringify({
        header: { version: 22 },
        repos: {
          isar: { url: 'u', branch: 'next' },
          other: { url: 'o', tag: 'v1' },
        },
      }),
      'kas.lock.json': codeBlock`
        {
          "header": { "version": 12 },
          "overrides": { "repos": { "isar": { "commit": "stale" } } }
        }
      `,
    };
    const res = await run('kas.json');
    // existing layout kept, only values and new keys touched
    expect(res).toMatchObject([
      {
        file: {
          path: 'kas.lock.json',
          contents: expect.stringContaining('"header": { "version": 14 }'),
        },
      },
    ]);
    expect(res).toMatchObject([
      {
        file: {
          contents: expect.stringContaining('"isar": { "commit": "new-isar" }'),
        },
      },
    ]);
    expect(res).toMatchObject([
      { file: { contents: expect.stringContaining('"commit": "new-other"') } },
    ]);
  });
});
