import { codeBlock } from 'common-tags';
import { fs, git, partial } from '~test/util.ts';
import type { PackageFile } from '../../../../modules/manager/types.ts';
import type { BranchConfig, BranchUpgradeConfig } from '../../../types.ts';
import { generateChangeset } from './changesets.ts';

vi.mock('../../../../util/fs/index.ts');

const changesetConfig = '{"ignore": ["@my-org/ignored-*"]}';

function mockFiles(
  local: Record<string, string>,
  base: Record<string, string> = {},
): void {
  fs.readLocalFile.mockImplementation((path) =>
    Promise.resolve(local[path] ?? null),
  );
  git.getFile.mockImplementation((path) => Promise.resolve(base[path] ?? null));
}

function packageJson(content: Record<string, unknown>): string {
  return JSON.stringify(content);
}

function getConfig(config: Partial<BranchConfig>): BranchConfig {
  return partial<BranchConfig>({
    baseBranch: 'main',
    postUpdateOptions: ['changesets'],
    upgrades: [],
    ...config,
  });
}

describe('workers/repository/update/branch/changesets', () => {
  describe('generateChangeset', () => {
    it('does nothing if the option is disabled', async () => {
      const config = partial<BranchConfig>({ postUpdateOptions: [] });

      await expect(generateChangeset(config, {})).resolves.toEqual([]);
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('does nothing without postUpdateOptions', async () => {
      const config = partial<BranchConfig>({});

      await expect(generateChangeset(config, {})).resolves.toEqual([]);
    });

    it('does nothing without a changesets config', async () => {
      mockFiles({});

      await expect(generateChangeset(getConfig({}), {})).resolves.toEqual([]);
    });

    it('does nothing with an invalid changesets config', async () => {
      mockFiles({ '.changeset/config.json': '{' });

      await expect(generateChangeset(getConfig({}), {})).resolves.toEqual([]);
    });

    it('does nothing if no published dependencies changed', async () => {
      mockFiles(
        { '.changeset/config.json': '{}' },
        {
          'package.json': packageJson({
            name: 'app',
            devDependencies: { foo: '1.0.0' },
          }),
        },
      );
      const config = getConfig({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package.json',
            contents: packageJson({
              name: 'app',
              devDependencies: { foo: '2.0.0' },
            }),
          },
        ],
      });

      await expect(generateChangeset(config, {})).resolves.toEqual([]);
    });

    it('bumps the packages whose dependencies changed', async () => {
      mockFiles(
        { '.changeset/config.json': changesetConfig },
        {
          'package.json': packageJson({
            name: 'root',
            private: true,
            dependencies: { foo: '^1.0.0' },
          }),
          'packages/a/package.json': packageJson({
            name: '@my-org/a',
            dependencies: { foo: '^1.0.0', old: '1.0.0' },
            optionalDependencies: { bar: '1.0.0' },
          }),
          'packages/b/package.json': packageJson({
            name: '@my-org/b',
            peerDependencies: { foo: '^1.0.0' },
            dependencies: { bar: '1.0.0' },
          }),
          'packages/ignored-c/package.json': packageJson({
            name: '@my-org/ignored-c',
            dependencies: { foo: '^1.0.0' },
          }),
          'packages/unnamed/package.json': packageJson({
            dependencies: { foo: '^1.0.0' },
          }),
          'packages/new/package.json': '{',
        },
      );
      const config = getConfig({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package.json',
            contents: packageJson({
              name: 'root',
              private: true,
              dependencies: { foo: '^2.0.0' },
            }),
          },
          {
            type: 'addition',
            path: 'packages/a/package.json',
            contents: packageJson({
              name: '@my-org/a',
              dependencies: { foo: '^2.0.0', new: '1.0.0' },
              optionalDependencies: { bar: '2.0.0' },
            }),
          },
          {
            type: 'addition',
            path: 'packages/b/package.json',
            contents: packageJson({
              name: '@my-org/b',
              peerDependencies: { foo: '^2.0.0' },
              dependencies: { bar: '2.0.0' },
            }),
          },
          {
            type: 'addition',
            path: 'packages/ignored-c/package.json',
            contents: packageJson({
              name: '@my-org/ignored-c',
              dependencies: { foo: '^2.0.0' },
            }),
          },
          {
            type: 'addition',
            path: 'packages/unnamed/package.json',
            contents: packageJson({ dependencies: { foo: '^2.0.0' } }),
          },
          {
            type: 'addition',
            path: 'packages/new/package.json',
            contents: packageJson({
              name: '@my-org/new',
              dependencies: { foo: '^2.0.0' },
            }),
          },
          {
            type: 'addition',
            path: 'packages/invalid/package.json',
            contents: '{',
          },
          { type: 'deletion', path: 'packages/deleted/package.json' },
          {
            type: 'addition',
            path: 'Dockerfile',
            contents: 'FROM node:24',
          },
        ],
      });

      const result = await generateChangeset(config, {});

      expect(result).toEqual([
        {
          type: 'addition',
          path: expect.stringMatching(
            /^\.changeset\/renovate-[0-9a-f]{10}\.md$/,
          ),
          contents: `${codeBlock`
            ---
            "@my-org/a": patch
            "@my-org/b": major
            "@my-org/new": patch
            ---

            Updated dependencies:

            - Updated \`foo\` from \`^1.0.0\` to \`^2.0.0\`
            - Removed \`old\`
            - Added \`new\` at \`1.0.0\`
            - Updated \`bar\` from \`1.0.0\` to \`2.0.0\`
            - Added \`foo\` at \`^2.0.0\`
          `}\n`,
        },
      ]);
      expect(git.getFile).toHaveBeenCalledWith(
        'packages/a/package.json',
        'main',
      );
    });

    it('uses the package files as rewritten by post-upgrade tasks', async () => {
      mockFiles(
        { '.changeset/config.json': '{}' },
        {
          'packages/a/package.json': packageJson({
            name: 'a',
            dependencies: { foo: '^1.0.0' },
          }),
          'packages/b/package.json': packageJson({
            name: 'b',
            dependencies: { foo: '^1.0.0' },
          }),
          'packages/c/package.json': packageJson({
            name: 'c',
            dependencies: { foo: '^1.0.0' },
          }),
        },
      );
      const config = getConfig({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'packages/a/package.json',
            contents: packageJson({
              name: 'a',
              dependencies: { foo: '^2.0.0' },
            }),
          },
          {
            type: 'addition',
            path: 'packages/b/package.json',
            contents: packageJson({
              name: 'b',
              dependencies: { foo: '^2.0.0' },
            }),
          },
        ],
        updatedArtifacts: [
          {
            type: 'addition',
            path: 'packages/a/package.json',
            contents: Buffer.from(
              packageJson({ name: 'a', dependencies: { foo: '^2.1.0' } }),
            ),
          },
          { type: 'deletion', path: 'packages/b/package.json' },
          {
            type: 'addition',
            path: 'packages/c/package.json',
            contents: null,
          },
        ],
      });

      const result = await generateChangeset(config, {});

      expect(result).toMatchObject([
        {
          contents: `${codeBlock`
            ---
            "a": patch
            ---

            Updated dependencies:

            - Updated \`foo\` from \`^1.0.0\` to \`^2.1.0\`
          `}\n`,
        },
      ]);
    });

    it('uses a stable file name for the same changes', async () => {
      mockFiles(
        { '.changeset/config.json': '{}' },
        { 'package.json': packageJson({ name: 'lib', dependencies: {} }) },
      );
      const config = getConfig({
        updatedPackageFiles: [
          {
            type: 'addition',
            path: 'package.json',
            contents: packageJson({
              name: 'lib',
              dependencies: { foo: '1.0.0' },
            }),
          },
        ],
      });

      const [first] = await generateChangeset(config, {});
      const [second] = await generateChangeset(config, {});

      expect(first.path).toBe(second.path);
    });

    it('bumps the packages consuming an updated catalog entry', async () => {
      mockFiles({
        '.changeset/config.json': '{}',
        'packages/a/package.json': packageJson({
          name: 'a',
          dependencies: { foo: 'catalog:', bar: '1.0.0' },
        }),
        'packages/b/package.json': packageJson({
          name: 'b',
          peerDependencies: { react: 'catalog:react17' },
        }),
        'packages/c/package.json': packageJson({
          name: 'c',
          dependencies: { foo: 'catalog:other', react: 'catalog:' },
        }),
      });
      const config = getConfig({
        upgrades: [
          partial<BranchUpgradeConfig>({
            depName: 'foo',
            depType: 'pnpm.catalog.default',
            currentValue: '1.0.0',
            newValue: '1.1.0',
          }),
          partial<BranchUpgradeConfig>({
            depName: 'react',
            depType: 'yarn.catalog.react17',
            currentValue: '17.0.1',
            newValue: '17.0.2',
          }),
          partial<BranchUpgradeConfig>({ depType: 'pnpm.catalog.default' }),
          partial<BranchUpgradeConfig>({
            depName: 'bar',
            depType: 'dependencies',
          }),
          partial<BranchUpgradeConfig>({ depName: 'baz' }),
        ],
      });
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          partial<PackageFile>({ packageFile: 'pnpm-workspace.yaml' }),
          partial<PackageFile>({ packageFile: 'packages/a/package.json' }),
          partial<PackageFile>({ packageFile: 'packages/c/package.json' }),
        ],
        bun: [partial<PackageFile>({ packageFile: 'packages/b/package.json' })],
      };

      const result = await generateChangeset(config, packageFiles);

      expect(result).toMatchObject([
        {
          contents: `${codeBlock`
            ---
            "a": patch
            "b": major
            ---

            Updated dependencies:

            - Updated \`foo\` (catalog \`default\`) from \`1.0.0\` to \`1.1.0\`
            - Updated \`react\` (catalog \`react17\`) from \`17.0.1\` to \`17.0.2\`
          `}\n`,
        },
      ]);
      expect(git.getFile).not.toHaveBeenCalled();
    });

    it('handles catalog updates without package files', async () => {
      mockFiles({ '.changeset/config.json': '{}' });
      const config = getConfig({
        upgrades: [
          partial<BranchUpgradeConfig>({
            depName: 'foo',
            depType: 'pnpm.catalog.default',
          }),
        ],
      });

      await expect(generateChangeset(config, undefined)).resolves.toEqual([]);
    });
  });
});
