import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import * as memCache from '../../../../util/cache/memory/index.ts';
import { findUvWorkspaceRoot, loadInheritedUvConfig } from './uv-workspace.ts';

vi.mock('../../../../util/fs/index.ts');

describe('modules/manager/pep621/processors/uv-workspace', () => {
  beforeEach(() => {
    memCache.init();
  });

  function mockRoot(path: string, contents: string) {
    fs.localPathExists.mockImplementation((p: string) =>
      Promise.resolve(p === path),
    );
    fs.readLocalFile.mockImplementation((p: string) =>
      Promise.resolve(p === path ? contents : null),
    );
  }

  describe('findUvWorkspaceRoot()', () => {
    it('returns null when no ancestor pyproject is found', async () => {
      fs.localPathExists.mockResolvedValue(false);
      expect(
        await findUvWorkspaceRoot('packages/foo/pyproject.toml'),
      ).toBeNull();
    });

    it('returns null when the ancestor pyproject does not declare a workspace', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [project]
          name = "root"
        `,
      );
      expect(
        await findUvWorkspaceRoot('packages/foo/pyproject.toml'),
      ).toBeNull();
    });

    it('finds an ancestor workspace root that lists the member', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [tool.uv.workspace]
          members = ["packages/*"]

          [tool.uv.sources]
          private-pkg = { index = "PrivateIndex" }

          [[tool.uv.index]]
          name = "PrivateIndex"
          url = "https://private/simple"
          explicit = true
        `,
      );
      const result = await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      expect(result?.rootPath).toBe('pyproject.toml');
      expect(result?.uv.sources?.['private-pkg']).toEqual({
        index: 'PrivateIndex',
      });
    });

    it('respects exclude globs', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [tool.uv.workspace]
          members = ["packages/*"]
          exclude = ["packages/foo"]

          [tool.uv.sources]
          private-pkg = { index = "PrivateIndex" }
        `,
      );
      expect(
        await findUvWorkspaceRoot('packages/foo/pyproject.toml'),
      ).toBeNull();
    });

    it('returns null when the workspace declaration does not list the member', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [tool.uv.workspace]
          members = ["apps/*"]
        `,
      );
      expect(
        await findUvWorkspaceRoot('packages/foo/pyproject.toml'),
      ).toBeNull();
    });

    it('ignores outer workspace roots when an inner one matches', async () => {
      const inner = codeBlock`
        [tool.uv.workspace]
        members = ["sub/*"]

        [tool.uv.sources]
        pkg = { index = "inner" }

        [[tool.uv.index]]
        name = "inner"
        url = "https://inner/simple"
        explicit = true
      `;
      const outer = codeBlock`
        [tool.uv.workspace]
        members = ["pkgs/**"]

        [tool.uv.sources]
        pkg = { index = "outer" }

        [[tool.uv.index]]
        name = "outer"
        url = "https://outer/simple"
        explicit = true
      `;
      fs.localPathExists.mockImplementation((p: string) =>
        Promise.resolve(
          p === 'pyproject.toml' || p === 'pkgs/inner/pyproject.toml',
        ),
      );
      fs.readLocalFile.mockImplementation((p: string) => {
        if (p === 'pkgs/inner/pyproject.toml') {
          return Promise.resolve(inner);
        }
        if (p === 'pyproject.toml') {
          return Promise.resolve(outer);
        }
        return Promise.resolve(null);
      });
      const result = await findUvWorkspaceRoot(
        'pkgs/inner/sub/leaf/pyproject.toml',
      );
      expect(result?.rootPath).toBe('pkgs/inner/pyproject.toml');
      expect(result?.uv.sources?.pkg).toEqual({ index: 'inner' });
    });

    it('skips ancestor pyproject.toml files that fail to parse', async () => {
      mockRoot('pyproject.toml', 'this = is = not = valid = toml');
      expect(
        await findUvWorkspaceRoot('packages/foo/pyproject.toml'),
      ).toBeNull();
    });

    it('caches parsed candidate pyprojects', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [tool.uv.workspace]
          members = ["packages/*"]
        `,
      );
      await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      await findUvWorkspaceRoot('packages/bar/pyproject.toml');
      expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('loadInheritedUvConfig()', () => {
    it('returns null when no workspace root is found', async () => {
      fs.localPathExists.mockResolvedValue(false);
      expect(
        await loadInheritedUvConfig('packages/foo/pyproject.toml'),
      ).toBeNull();
    });

    it('returns null when the workspace root has no sources or indexes', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [tool.uv.workspace]
          members = ["packages/*"]
        `,
      );
      expect(
        await loadInheritedUvConfig('packages/foo/pyproject.toml'),
      ).toBeNull();
    });

    it('returns the workspace root sources and indexes', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [tool.uv.workspace]
          members = ["packages/*"]

          [tool.uv.sources]
          private-pkg = { index = "PrivateIndex" }
          some-internal-pkg = { workspace = true }

          [[tool.uv.index]]
          name = "PrivateIndex"
          url = "https://private/simple"
          explicit = true
        `,
      );
      const inherited = await loadInheritedUvConfig(
        'packages/foo/pyproject.toml',
      );
      expect(inherited).not.toBeNull();
      expect(inherited!.rootPath).toBe('pyproject.toml');
      expect(inherited!.sources['private-pkg']).toEqual({
        index: 'PrivateIndex',
      });
      expect(inherited!.sources['some-internal-pkg']).toEqual({
        workspace: true,
      });
      expect(inherited!.indexes).toEqual([
        {
          name: 'PrivateIndex',
          url: 'https://private/simple',
          default: false,
          explicit: true,
        },
      ]);
    });

    it('returns empty sources/indexes containers when only one side is present', async () => {
      mockRoot(
        'pyproject.toml',
        codeBlock`
          [tool.uv.workspace]
          members = ["packages/*"]

          [[tool.uv.index]]
          name = "OnlyIndex"
          url = "https://only/simple"
          explicit = true
        `,
      );
      const inherited = await loadInheritedUvConfig(
        'packages/foo/pyproject.toml',
      );
      expect(inherited?.sources).toEqual({});
      expect(inherited?.indexes).toHaveLength(1);
    });
  });
});
