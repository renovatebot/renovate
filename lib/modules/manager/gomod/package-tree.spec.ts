import { codeBlock } from 'common-tags';
import { fs, scm } from '~test/util.ts';
import {
  buildGoModDependencyGraph,
  getGoModulesInTidyOrder,
  getModuleName,
  hasLocalReplaceDirectives,
  parseReplaceDirectives,
  resolveGoModulePath,
} from './package-tree.ts';

vi.mock('../../../util/fs/index.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../util/fs/index.ts')>();
  return { ...actual, readLocalFile: vi.fn() };
});

describe('modules/manager/gomod/package-tree', () => {
  describe('parseReplaceDirectives', () => {
    it('parses single-line replace with local path', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        replace github.com/example/dep => ../dep
      `;

      expect(parseReplaceDirectives(content)).toEqual([
        { oldPath: 'github.com/example/dep', newPath: '../dep' },
      ]);
    });

    it('parses single-line replace with ./ prefix', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        replace github.com/example/dep => ./local-dep
      `;

      expect(parseReplaceDirectives(content)).toEqual([
        { oldPath: 'github.com/example/dep', newPath: './local-dep' },
      ]);
    });

    it('parses single-line replace with version on old module', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        replace github.com/example/dep v1.0.0 => ../dep
      `;

      expect(parseReplaceDirectives(content)).toEqual([
        { oldPath: 'github.com/example/dep', newPath: '../dep' },
      ]);
    });

    it('ignores non-local replace directives', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        replace github.com/example/dep => github.com/fork/dep v1.0.0
      `;

      expect(parseReplaceDirectives(content)).toEqual([]);
    });

    it('parses multi-line replace block', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        replace (
            github.com/example/dep1 => ../dep1
            github.com/example/dep2 => ./local-dep2
        )
      `;

      expect(parseReplaceDirectives(content)).toEqual([
        { oldPath: 'github.com/example/dep1', newPath: '../dep1' },
        { oldPath: 'github.com/example/dep2', newPath: './local-dep2' },
      ]);
    });

    it('filters non-local from multi-line block', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        replace (
            github.com/example/dep1 => ../dep1
            github.com/remote/dep => github.com/fork/dep v1.0.0
        )
      `;

      expect(parseReplaceDirectives(content)).toEqual([
        { oldPath: 'github.com/example/dep1', newPath: '../dep1' },
      ]);
    });

    it('handles mixed single-line and block replaces', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        replace github.com/example/dep1 => ../dep1

        replace (
            github.com/example/dep2 => ./dep2
        )
      `;

      expect(parseReplaceDirectives(content)).toEqual([
        { oldPath: 'github.com/example/dep1', newPath: '../dep1' },
        { oldPath: 'github.com/example/dep2', newPath: './dep2' },
      ]);
    });

    it('returns empty for content without replaces', () => {
      const content = codeBlock`
        module example.com/mymodule

        go 1.21

        require github.com/example/dep v1.0.0
      `;

      expect(parseReplaceDirectives(content)).toEqual([]);
    });

    it('returns empty for empty content', () => {
      expect(parseReplaceDirectives('')).toEqual([]);
    });
  });

  describe('resolveGoModulePath', () => {
    it('resolves parent directory reference', () => {
      const result = resolveGoModulePath('moduleA/go.mod', {
        oldPath: 'github.com/example/dep',
        newPath: '../shared',
      });
      expect(result).toBe('shared/go.mod');
    });

    it('resolves same-directory reference', () => {
      const result = resolveGoModulePath('moduleA/go.mod', {
        oldPath: 'github.com/example/dep',
        newPath: './local',
      });
      expect(result).toBe('moduleA/local/go.mod');
    });

    it('resolves nested path', () => {
      const result = resolveGoModulePath('services/api/go.mod', {
        oldPath: 'github.com/example/dep',
        newPath: '../../libs/shared',
      });
      expect(result).toBe('libs/shared/go.mod');
    });

    it('resolves from root go.mod', () => {
      const result = resolveGoModulePath('go.mod', {
        oldPath: 'github.com/example/dep',
        newPath: './sub',
      });
      expect(result).toBe('sub/go.mod');
    });
  });

  describe('buildGoModDependencyGraph', () => {
    it('builds graph from go.mod files with local replace directives', async () => {
      scm.getFileList.mockResolvedValue([
        'shared/go.mod',
        'api/go.mod',
        'cmd/go.mod',
      ]);

      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'shared/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/shared
            go 1.21
          `);
        }
        if (path === 'api/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/api
            go 1.21
            replace github.com/example/shared => ../shared
          `);
        }
        if (path === 'cmd/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/cmd
            go 1.21
            replace github.com/example/api => ../api
          `);
        }
        return Promise.resolve(null);
      });

      const graph = await buildGoModDependencyGraph();

      // shared -> api -> cmd (edge direction: dependency -> dependent)
      const sharedDeps = graph.adjacent('shared/go.mod');
      expect(sharedDeps).toBeDefined();
      expect(sharedDeps!.has('api/go.mod')).toBe(true);

      const apiDeps = graph.adjacent('api/go.mod');
      expect(apiDeps).toBeDefined();
      expect(apiDeps!.has('cmd/go.mod')).toBe(true);
    });

    it('ignores replace directives pointing to non-existent modules', async () => {
      scm.getFileList.mockResolvedValue(['api/go.mod']);

      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'api/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/api
            go 1.21
            replace github.com/example/shared => ../shared
          `);
        }
        return Promise.resolve(null);
      });

      const graph = await buildGoModDependencyGraph();

      // No edge because shared/go.mod doesn't exist in file list
      const apiDeps = graph.adjacent('api/go.mod');
      expect(apiDeps?.size ?? 0).toBe(0);
    });

    it('handles go.mod with no content', async () => {
      scm.getFileList.mockResolvedValue(['api/go.mod']);
      fs.readLocalFile.mockResolvedValue(null);

      const graph = await buildGoModDependencyGraph();
      expect(graph.adjacent('api/go.mod')?.size ?? 0).toBe(0);
    });

    it('includes root go.mod in graph', async () => {
      scm.getFileList.mockResolvedValue(['go.mod', 'sub/go.mod']);

      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/root
            go 1.21
          `);
        }
        if (path === 'sub/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/sub
            go 1.21
            replace github.com/example/root => ../
          `);
        }
        return Promise.resolve(null);
      });

      const graph = await buildGoModDependencyGraph();
      const rootDeps = graph.adjacent('go.mod');
      expect(rootDeps).toBeDefined();
      expect(rootDeps!.has('sub/go.mod')).toBe(true);
    });
  });

  describe('getGoModulesInTidyOrder', () => {
    it('returns dependent modules in topological order', async () => {
      scm.getFileList.mockResolvedValue([
        'shared/go.mod',
        'api/go.mod',
        'cmd/go.mod',
      ]);

      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'shared/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/shared
            go 1.21
          `);
        }
        if (path === 'api/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/api
            go 1.21
            replace github.com/example/shared => ../shared
          `);
        }
        if (path === 'cmd/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/cmd
            go 1.21
            replace github.com/example/api => ../api
          `);
        }
        return Promise.resolve(null);
      });

      const result = await getGoModulesInTidyOrder('shared/go.mod');

      // Should include api and cmd (but NOT shared itself)
      expect(result).toContain('api/go.mod');
      expect(result).toContain('cmd/go.mod');
      expect(result).not.toContain('shared/go.mod');

      // api should come before cmd (topological order)
      const apiIndex = result.indexOf('api/go.mod');
      const cmdIndex = result.indexOf('cmd/go.mod');
      expect(apiIndex).toBeLessThan(cmdIndex);
    });

    it('returns empty array when module has no dependents', async () => {
      scm.getFileList.mockResolvedValue(['shared/go.mod', 'api/go.mod']);

      fs.readLocalFile.mockImplementation((path: string) => {
        if (path === 'shared/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/shared
            go 1.21
          `);
        }
        if (path === 'api/go.mod') {
          return Promise.resolve(codeBlock`
            module github.com/example/api
            go 1.21
          `);
        }
        return Promise.resolve(null);
      });

      const result = await getGoModulesInTidyOrder('shared/go.mod');
      expect(result).toEqual([]);
    });

    it('returns empty array when module not in graph', async () => {
      scm.getFileList.mockResolvedValue(['api/go.mod']);
      fs.readLocalFile.mockResolvedValue(codeBlock`
        module github.com/example/api
        go 1.21
      `);

      const result = await getGoModulesInTidyOrder('nonexistent/go.mod');
      expect(result).toEqual([]);
    });
  });

  describe('hasLocalReplaceDirectives', () => {
    it('returns true when local replaces exist', () => {
      const content = codeBlock`
        module example.com/mymodule

        replace github.com/example/dep => ../dep
      `;
      expect(hasLocalReplaceDirectives(content)).toBe(true);
    });

    it('returns false for remote replaces only', () => {
      const content = codeBlock`
        module example.com/mymodule

        replace github.com/example/dep => github.com/fork/dep v1.0.0
      `;
      expect(hasLocalReplaceDirectives(content)).toBe(false);
    });

    it('returns false for no replaces', () => {
      const content = codeBlock`
        module example.com/mymodule

        require github.com/example/dep v1.0.0
      `;
      expect(hasLocalReplaceDirectives(content)).toBe(false);
    });
  });

  describe('getModuleName', () => {
    it('extracts module name', () => {
      const content = codeBlock`
        module github.com/example/mymodule

        go 1.21
      `;
      expect(getModuleName(content)).toBe('github.com/example/mymodule');
    });

    it('returns null for missing module directive', () => {
      const content = codeBlock`
        go 1.21

        require github.com/example/dep v1.0.0
      `;
      expect(getModuleName(content)).toBeNull();
    });

    it('returns null for empty content', () => {
      expect(getModuleName('')).toBeNull();
    });
  });
});
