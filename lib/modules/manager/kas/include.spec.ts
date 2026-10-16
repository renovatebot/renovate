import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import {
  getLockFilePath,
  isLockFilePath,
  isYamlFilePath,
  loadKasConfigTree,
  mergeConfigs,
} from './include.ts';

vi.mock('../../../util/fs/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../util/fs/index.ts')>()),
  readLocalFile: vi.fn(),
  localPathExists: vi.fn(),
}));

let files: Record<string, string>;

const baseFiles: Record<string, string> = {
  'kas.yml': codeBlock`
    header:
      version: 22
      includes:
        - kas/inc.yml
        - repo: meta
          file: x.yml
    repos:
      isar:
        url: https://github.com/ilbers/isar.git
        branch: next
      other:
        tag: v2
  `,
  'kas.lock.yml': codeBlock`
    header:
      version: 22
    overrides:
      repos:
        isar:
          commit: aaaa
  `,
  'kas/inc.yml': codeBlock`
    header:
      version: 22
      includes:
        - rel.yml
    repos:
      other:
        url: https://example.com/other.git
        tag: v1
  `,
  'kas/inc.lock.yml': codeBlock`
    header:
      version: 22
    overrides:
      repos:
        isar:
          commit: bbbb
  `,
  'kas/rel.yml': codeBlock`
    header:
      version: 22
    repos:
      third:
        url: https://example.com/third.git
        branch: main
  `,
};

describe('modules/manager/kas/include', () => {
  beforeEach(() => {
    files = { ...baseFiles };
    fs.readLocalFile.mockImplementation((p) =>
      Promise.resolve(files[p] ?? null),
    );
    fs.localPathExists.mockImplementation((p) => Promise.resolve(p in files));
  });

  describe('path helpers', () => {
    it.each`
      path               | lock     | yaml     | lockPath
      ${'kas.yml'}       | ${false} | ${true}  | ${'kas.lock.yml'}
      ${'a/kas.yaml'}    | ${false} | ${true}  | ${'a/kas.lock.yaml'}
      ${'kas.json'}      | ${false} | ${false} | ${'kas.lock.json'}
      ${'kas.lock.yml'}  | ${true}  | ${true}  | ${null}
      ${'kas.lock.json'} | ${true}  | ${false} | ${null}
      ${'kas.txt'}       | ${false} | ${false} | ${null}
    `('$path', ({ path, lock, yaml, lockPath }) => {
      expect(isLockFilePath(path)).toBe(lock);
      expect(isYamlFilePath(path)).toBe(yaml);
      expect(getLockFilePath(path)).toBe(lockPath);
    });
  });

  describe('mergeConfigs', () => {
    it('deep merges, later wins, keeps unrelated keys', () => {
      const merged = mergeConfigs([
        {
          path: 'a',
          isLockFile: false,
          content: '',
          config: {
            header: { version: 1 },
            repos: { x: { url: 'u', branch: 'b' }, y: undefined },
            overrides: { repos: { x: { commit: '1' } } },
          },
        },
        {
          path: 'b',
          isLockFile: false,
          content: '',
          config: {
            header: { version: 2 },
            repos: { x: { branch: 'c' }, z: { url: 'z' } },
          },
        },
      ]);
      expect(merged).toEqual({
        header: { version: 2 },
        repos: { x: { url: 'u', branch: 'c' }, y: undefined, z: { url: 'z' } },
        overrides: { repos: { x: { commit: '1' } } },
      });
    });
  });

  describe('loadKasConfigTree', () => {
    it('orders lockfile, includes depth-first, self; later wins', async () => {
      const tree = await loadKasConfigTree('kas.yml');
      expect(tree?.files.map((f) => [f.path, f.isLockFile])).toEqual([
        ['kas.lock.yml', true],
        ['kas/inc.lock.yml', true],
        ['kas/rel.yml', false],
        ['kas/inc.yml', false],
        ['kas.yml', false],
      ]);
      expect(tree?.merged.repos?.other).toEqual({
        url: 'https://example.com/other.git',
        tag: 'v2',
        type: 'git',
      });
      expect(tree?.merged.repos?.third?.branch).toBe('main');
      // kas.lock.yml is merged first, kas/inc.lock.yml later -> later wins
      expect(tree?.merged.overrides?.repos?.isar.commit).toBe('bbbb');
      expect(tree?.mergedNoLock.overrides).toBeUndefined();
      expect(tree?.files[4].content).toBe(files['kas.yml']);
      expect(tree?.hasCrossRepoIncludes).toBe(true);
    });

    it('reports no cross-repo includes', async () => {
      files['kas.yml'] = files['kas.yml'].replace(
        /\s+- repo: meta\n\s+file: x.yml/,
        '',
      );
      const tree = await loadKasConfigTree('kas.yml');
      expect(tree?.hasCrossRepoIncludes).toBe(false);
    });

    it('merges a file included twice at both positions like kas', async () => {
      files = {
        'a.yml': codeBlock`
          header:
            version: 22
            includes:
              - b.yml
              - ./c.yml
        `,
        'b.yml': codeBlock`
          header:
            version: 22
            includes:
              - c.yml
          repos:
            x:
              url: u
              branch: from-b
        `,
        'c.yml': codeBlock`
          header:
            version: 22
          repos:
            x:
              url: u
              branch: from-c
        `,
      };
      const tree = await loadKasConfigTree('a.yml');
      expect(tree?.files.map((f) => f.path)).toEqual([
        'c.yml',
        'b.yml',
        'c.yml',
        'a.yml',
      ]);
      expect(tree?.merged.repos?.x?.branch).toBe('from-c');
    });

    it('resolves repo-relative includes before file-relative', async () => {
      files['rel.yml'] = codeBlock`
        header:
          version: 22
        repos:
          rootrel:
            url: https://example.com/root.git
            branch: main
      `;
      const tree = await loadKasConfigTree('kas.yml');
      expect(tree?.files.map((f) => f.path)).toContain('rel.yml');
      expect(tree?.files.map((f) => f.path)).not.toContain('kas/rel.yml');
      expect(tree?.merged.repos?.rootrel).toBeDefined();
    });

    it('returns null for missing include (kas fails too)', async () => {
      delete files['kas/rel.yml'];
      await expect(loadKasConfigTree('kas.yml')).resolves.toBeNull();
    });

    it('returns null on include cycle', async () => {
      files['kas/rel.yml'] = codeBlock`
        header:
          version: 22
          includes:
            - kas.yml
      `;
      await expect(loadKasConfigTree('kas.yml')).resolves.toBeNull();
    });

    it('supports json files', async () => {
      files = {
        'kas.json': JSON.stringify({
          header: { version: 22, includes: ['inc.json'] },
          repos: { a: { url: 'u', branch: 'b' } },
        }),
        'kas.lock.json': JSON.stringify({
          header: { version: 14 },
          overrides: { repos: { a: { commit: 'c' } } },
        }),
        'inc.json': JSON.stringify({
          header: { version: 22 },
          repos: { b: { url: 'u2', tag: 't' } },
        }),
      };
      const tree = await loadKasConfigTree('kas.json');
      expect(tree?.files.map((f) => f.path)).toEqual([
        'kas.lock.json',
        'inc.json',
        'kas.json',
      ]);
      expect(tree?.merged.overrides?.repos?.a.commit).toBe('c');
      expect(tree?.merged.repos?.b?.tag).toBe('t');
    });

    it('returns null for missing root', async () => {
      await expect(loadKasConfigTree('nope.yml')).resolves.toBeNull();
    });

    it('returns null for invalid root', async () => {
      files['bad.yml'] = 'header: [';
      await expect(loadKasConfigTree('bad.yml')).resolves.toBeNull();
    });

    it('returns null when an include is invalid', async () => {
      files['kas/rel.yml'] = 'repos: {}';
      await expect(loadKasConfigTree('kas.yml')).resolves.toBeNull();
    });
  });
});
