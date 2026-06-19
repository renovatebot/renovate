import { codeBlock } from 'common-tags';
import { fs, scm } from '~test/util.ts';
import {
  buildGoModDependencyGraph,
  getGoModulesInTidyOrder,
  parseReplaceDirectives,
} from './package-tree.ts';

vi.mock('../../../util/fs/index.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../util/fs/index.ts')>();
  return { ...actual, readLocalFile: vi.fn() };
});

describe('modules/manager/gomod/package-tree', () => {
  describe('parseReplaceDirectives', () => {
    it('parses single-line and block replaces, filters non-local', () => {
      const content = codeBlock`
        module example.com/mymodule
        go 1.21

        replace github.com/example/a => ../a
        replace github.com/example/b v1 => ./b
        replace github.com/example/c => github.com/fork/c v1.0.0

        replace (
            github.com/example/d => ../d
            github.com/example/e => github.com/fork/e v1.0.0
        )
      `;

      expect(parseReplaceDirectives(content)).toEqual([
        { oldPath: 'github.com/example/a', newPath: '../a' },
        { oldPath: 'github.com/example/b', newPath: './b' },
        { oldPath: 'github.com/example/d', newPath: '../d' },
      ]);
    });

    it('returns empty array for content without replaces', () => {
      expect(parseReplaceDirectives('')).toEqual([]);
      expect(parseReplaceDirectives('module x\nrequire y v1\n')).toEqual([]);
    });
  });

  describe('buildGoModDependencyGraph', () => {
    it('builds graph with edges dependency -> dependent, skipping unknown deps', async () => {
      scm.getFileList.mockResolvedValue([
        'shared/go.mod',
        'api/go.mod',
        'cmd/go.mod',
      ]);
      fs.readLocalFile.mockImplementation((path: string) => {
        switch (path) {
          case 'shared/go.mod':
            return Promise.resolve('module example.com/shared\n');
          case 'api/go.mod':
            return Promise.resolve(
              'module example.com/api\nreplace example.com/shared => ../shared\nreplace example.com/missing => ../missing\n',
            );
          case 'cmd/go.mod':
            return Promise.resolve(
              'module example.com/cmd\nreplace example.com/api => ../api\n',
            );
          default:
            return Promise.resolve(null);
        }
      });

      const graph = await buildGoModDependencyGraph();

      expect(graph.adjacent('shared/go.mod')?.has('api/go.mod')).toBe(true);
      expect(graph.adjacent('api/go.mod')?.has('cmd/go.mod')).toBe(true);
      // missing dep is ignored
      expect(graph.adjacent('../missing/go.mod')).toBeUndefined();
    });

    it('handles go.mod with no readable content', async () => {
      scm.getFileList.mockResolvedValue(['api/go.mod']);
      fs.readLocalFile.mockResolvedValue(null);

      const graph = await buildGoModDependencyGraph();
      expect(graph.adjacent('api/go.mod')?.size ?? 0).toBe(0);
    });
  });

  describe('getGoModulesInTidyOrder', () => {
    it('returns dependents in topological order and excludes the target', async () => {
      scm.getFileList.mockResolvedValue([
        'shared/go.mod',
        'api/go.mod',
        'cmd/go.mod',
      ]);
      fs.readLocalFile.mockImplementation((path: string) => {
        switch (path) {
          case 'shared/go.mod':
            return Promise.resolve('module example.com/shared\n');
          case 'api/go.mod':
            return Promise.resolve(
              'module example.com/api\nreplace example.com/shared => ../shared\n',
            );
          case 'cmd/go.mod':
            return Promise.resolve(
              'module example.com/cmd\nreplace example.com/api => ../api\n',
            );
          default:
            return Promise.resolve(null);
        }
      });

      expect(await getGoModulesInTidyOrder('shared/go.mod')).toEqual([
        'api/go.mod',
        'cmd/go.mod',
      ]);
    });

    it('returns [] when target has no dependents or is unknown', async () => {
      scm.getFileList.mockResolvedValue(['a/go.mod']);
      fs.readLocalFile.mockResolvedValue('module example.com/a\n');

      expect(await getGoModulesInTidyOrder('a/go.mod')).toEqual([]);
      expect(await getGoModulesInTidyOrder('nowhere/go.mod')).toEqual([]);
    });
  });
});
