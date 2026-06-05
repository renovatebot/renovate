import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import * as memCache from '../../../../util/cache/memory/index.ts';
import { parsePyProject } from '../extract.ts';
import {
  findUvWorkspaceRoot,
  getEffectiveUvConfig,
  mergeUvConfig,
} from './uv-workspace.ts';

vi.mock('../../../../util/fs/index.ts');

describe('modules/manager/pep621/processors/uv-workspace', () => {
  beforeEach(() => {
    memCache.init();
  });

  describe('mergeUvConfig()', () => {
    it('returns undefined when nothing is configured', () => {
      expect(mergeUvConfig(undefined, undefined)).toBeUndefined();
    });

    it('returns undefined when root only declares workspace (no sources/index)', () => {
      const rootUv = parsePyProject(codeBlock`
        [tool.uv.workspace]
        members = ["packages/*"]
      `)!.tool!.uv!;
      expect(mergeUvConfig(rootUv, undefined)).toBeUndefined();
    });

    it('inherits sources and indexes when member has no [tool.uv]', () => {
      const rootUv = parsePyProject(codeBlock`
        [tool.uv.sources]
        private-pkg = { index = "private" }

        [[tool.uv.index]]
        name = "private"
        url = "https://private/simple"
        explicit = true
      `)!.tool!.uv!;
      const merged = mergeUvConfig(rootUv, undefined);
      expect(merged?.sources).toEqual({
        'private-pkg': { index: 'private' },
      });
      expect(merged?.index).toEqual([
        {
          name: 'private',
          url: 'https://private/simple',
          default: false,
          explicit: true,
        },
      ]);
    });

    it('member sources override root sources on the same key', () => {
      const rootUv = parsePyProject(codeBlock`
        [tool.uv.sources]
        pkg = { index = "root-idx" }

        [[tool.uv.index]]
        name = "root-idx"
        url = "https://root/simple"
        explicit = true
      `)!.tool!.uv!;
      const memberUv = parsePyProject(codeBlock`
        [tool.uv.sources]
        pkg = { index = "member-idx" }

        [[tool.uv.index]]
        name = "member-idx"
        url = "https://member/simple"
        explicit = true
      `)!.tool!.uv!;
      const merged = mergeUvConfig(rootUv, memberUv);
      expect(merged?.sources?.pkg).toEqual({ index: 'member-idx' });
      // Both indexes are present in the union, but member's wins on name.
      const names = merged?.index?.map((i) => i.name);
      expect(names).toContain('member-idx');
      expect(names).toContain('root-idx');
    });

    it('member-only sources for other deps fall through to root for unrelated deps', () => {
      const rootUv = parsePyProject(codeBlock`
        [tool.uv.sources]
        root-pkg = { index = "root-idx" }

        [[tool.uv.index]]
        name = "root-idx"
        url = "https://root/simple"
        explicit = true
      `)!.tool!.uv!;
      const memberUv = parsePyProject(codeBlock`
        [tool.uv.sources]
        member-pkg = { workspace = true }
      `)!.tool!.uv!;
      const merged = mergeUvConfig(rootUv, memberUv);
      expect(merged?.sources?.['root-pkg']).toEqual({ index: 'root-idx' });
      expect(merged?.sources?.['member-pkg']).toEqual({ workspace: true });
    });

    it('member-redeclared index with same name wins', () => {
      const rootUv = parsePyProject(codeBlock`
        [[tool.uv.index]]
        name = "shared"
        url = "https://root/simple"
        default = true
        explicit = false
      `)!.tool!.uv!;
      const memberUv = parsePyProject(codeBlock`
        [[tool.uv.index]]
        name = "shared"
        url = "https://member/simple"
        default = false
        explicit = true
      `)!.tool!.uv!;
      const merged = mergeUvConfig(rootUv, memberUv);
      expect(merged?.index).toEqual([
        {
          name: 'shared',
          url: 'https://member/simple',
          default: false,
          explicit: true,
        },
      ]);
    });

    it('does not inherit dev-dependencies from the root', () => {
      const rootUv = parsePyProject(codeBlock`
        [tool.uv]
        dev-dependencies = ["root-dev==1.0.0"]
      `)!.tool!.uv!;
      const memberUv = parsePyProject(codeBlock`
        [tool.uv]
        dev-dependencies = ["member-dev==2.0.0"]
      `)!.tool!.uv!;
      const merged = mergeUvConfig(rootUv, memberUv);
      expect(merged?.['dev-dependencies']).toHaveLength(1);
      expect(merged?.['dev-dependencies']?.[0].packageName).toBe('member-dev');
    });
  });

  describe('findUvWorkspaceRoot()', () => {
    function mockFile(path: string, contents: string) {
      fs.localPathExists.mockImplementation((p: string) =>
        Promise.resolve(p === path),
      );
      fs.readLocalFile.mockImplementation((p: string) =>
        Promise.resolve(p === path ? contents : null),
      );
    }

    it('returns null when no ancestor pyproject is found', async () => {
      fs.localPathExists.mockResolvedValue(false);
      const result = await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      expect(result).toBeNull();
    });

    it('returns null when the ancestor pyproject does not declare a workspace', async () => {
      mockFile(
        'pyproject.toml',
        codeBlock`
        [project]
        name = "root"
      `,
      );
      const result = await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      expect(result).toBeNull();
    });

    it('finds an ancestor workspace root that lists the member', async () => {
      mockFile(
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
      expect(result).not.toBeNull();
      expect(result!.rootPath).toBe('pyproject.toml');
      expect(result!.uv.sources?.['private-pkg']).toEqual({
        index: 'PrivateIndex',
      });
    });

    it('respects exclude globs', async () => {
      mockFile(
        'pyproject.toml',
        codeBlock`
        [tool.uv.workspace]
        members = ["packages/*"]
        exclude = ["packages/foo"]

        [tool.uv.sources]
        private-pkg = { index = "PrivateIndex" }

        [[tool.uv.index]]
        name = "PrivateIndex"
        url = "https://private/simple"
        explicit = true
      `,
      );
      const result = await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      expect(result).toBeNull();
    });

    it('returns null when the workspace declaration does not list the member', async () => {
      mockFile(
        'pyproject.toml',
        codeBlock`
        [tool.uv.workspace]
        members = ["apps/*"]
      `,
      );
      const result = await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      expect(result).toBeNull();
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
      mockFile('pyproject.toml', 'this = is = not = valid = toml');
      const result = await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      expect(result).toBeNull();
    });

    it('caches parsed candidate pyprojects', async () => {
      mockFile(
        'pyproject.toml',
        codeBlock`
        [tool.uv.workspace]
        members = ["packages/*"]
      `,
      );
      await findUvWorkspaceRoot('packages/foo/pyproject.toml');
      await findUvWorkspaceRoot('packages/bar/pyproject.toml');
      // 2 lookups for foo (packages/pyproject.toml + pyproject.toml),
      // 2 for bar — but readLocalFile only called once for the cached root.
      expect(fs.readLocalFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEffectiveUvConfig()', () => {
    it('returns the member config when no workspace root exists', async () => {
      fs.localPathExists.mockResolvedValue(false);
      const memberUv = parsePyProject(codeBlock`
        [tool.uv.sources]
        dep1 = { workspace = true }
      `)!.tool!.uv!;
      const eff = await getEffectiveUvConfig(
        memberUv,
        'packages/foo/pyproject.toml',
      );
      expect(eff?.sources?.dep1).toEqual({ workspace: true });
    });

    it('inherits from the workspace root', async () => {
      fs.localPathExists.mockImplementation((p: string) =>
        Promise.resolve(p === 'pyproject.toml'),
      );
      fs.readLocalFile.mockImplementation((p: string) =>
        Promise.resolve(
          p === 'pyproject.toml'
            ? codeBlock`
              [tool.uv.workspace]
              members = ["packages/*"]

              [tool.uv.sources]
              private-pkg = { index = "PrivateIndex" }
              some-internal-pkg = { workspace = true }

              [[tool.uv.index]]
              name = "PrivateIndex"
              url = "https://private/simple"
              explicit = true
            `
            : null,
        ),
      );
      const eff = await getEffectiveUvConfig(
        undefined,
        'packages/foo/pyproject.toml',
      );
      expect(eff?.sources?.['private-pkg']).toEqual({ index: 'PrivateIndex' });
      expect(eff?.sources?.['some-internal-pkg']).toEqual({ workspace: true });
      expect(eff?.index?.[0].url).toBe('https://private/simple');
    });
  });
});
