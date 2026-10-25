import { codeBlock } from 'common-tags';
import { fs, git, partial } from '~test/util.ts';
import type { FileChange } from '../../../../util/git/types.ts';
import type { PostUpdateConfig, Upgrade } from '../../types.ts';
import type { NpmManagerData } from '../types.ts';
import { generateChangesets } from './changesets.ts';
import type { AdditionalPackageFiles } from './types.ts';

vi.mock('../../../../util/fs/index.ts');

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

function updatedPackageJson(
  path: string,
  content: Record<string, unknown>,
): FileChange {
  return { type: 'addition', path, contents: packageJson(content) };
}

function getConfig(
  config: Partial<PostUpdateConfig<NpmManagerData>>,
): PostUpdateConfig<NpmManagerData> {
  return partial<PostUpdateConfig<NpmManagerData>>({
    baseBranch: 'main',
    postUpdateOptions: ['changesets'],
    upgrades: [],
    ...config,
  });
}

function getPackageFiles(...paths: string[]): AdditionalPackageFiles {
  return { npm: paths.map((packageFile) => ({ packageFile })) };
}

describe('modules/manager/npm/post-update/changesets', () => {
  describe('generateChangesets', () => {
    it('does nothing if the option is disabled', async () => {
      const config = getConfig({ postUpdateOptions: [] });

      await expect(generateChangesets(config, {})).resolves.toEqual([]);
      expect(fs.readLocalFile).not.toHaveBeenCalled();
    });

    it('does nothing without postUpdateOptions', async () => {
      const config = getConfig({ postUpdateOptions: undefined });

      await expect(generateChangesets(config, {})).resolves.toEqual([]);
    });

    it('does nothing without a changesets config', async () => {
      mockFiles({});

      await expect(generateChangesets(getConfig({}), {})).resolves.toEqual([]);
    });

    it('does nothing with an invalid changesets config', async () => {
      mockFiles({ '.changeset/config.json': '{' });

      await expect(generateChangesets(getConfig({}), {})).resolves.toEqual([]);
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
          updatedPackageJson('package.json', {
            name: 'app',
            devDependencies: { foo: '2.0.0' },
          }),
        ],
      });

      await expect(
        generateChangesets(config, getPackageFiles('package.json')),
      ).resolves.toEqual([]);
    });

    it('bumps the packages whose dependencies changed', async () => {
      mockFiles(
        { '.changeset/config.json': '{"ignore": ["@my-org/ignored-*"]}' },
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
          'packages/other-manager/package.json': packageJson({
            name: '@my-org/other-manager',
            dependencies: { foo: '^1.0.0' },
          }),
        },
      );
      const config = getConfig({
        updatedPackageFiles: [
          updatedPackageJson('package.json', {
            name: 'root',
            private: true,
            dependencies: { foo: '^2.0.0' },
          }),
          updatedPackageJson('packages/a/package.json', {
            name: '@my-org/a',
            dependencies: { foo: '^2.0.0', new: '1.0.0' },
            optionalDependencies: { bar: '2.0.0' },
          }),
          updatedPackageJson('packages/b/package.json', {
            name: '@my-org/b',
            peerDependencies: { foo: '^2.0.0' },
            dependencies: { bar: '2.0.0' },
          }),
          updatedPackageJson('packages/ignored-c/package.json', {
            name: '@my-org/ignored-c',
            dependencies: { foo: '^2.0.0' },
          }),
          updatedPackageJson('packages/unnamed/package.json', {
            dependencies: { foo: '^2.0.0' },
          }),
          updatedPackageJson('packages/new/package.json', {
            name: '@my-org/new',
            dependencies: { foo: '^2.0.0' },
          }),
          updatedPackageJson('packages/other-manager/package.json', {
            name: '@my-org/other-manager',
            dependencies: { foo: '^2.0.0' },
          }),
          {
            type: 'addition',
            path: 'packages/invalid/package.json',
            contents: '{',
          },
          {
            type: 'addition',
            path: 'packages/buffer/package.json',
            contents: Buffer.from('{}'),
          },
          { type: 'deletion', path: 'packages/deleted/package.json' },
        ],
      });
      const packageFiles: AdditionalPackageFiles = {
        npm: [
          { packageFile: 'package.json' },
          { packageFile: 'packages/a/package.json' },
          { packageFile: 'packages/b/package.json' },
          { packageFile: 'packages/ignored-c/package.json' },
          { packageFile: 'packages/unnamed/package.json' },
          { packageFile: 'packages/new/package.json' },
          { packageFile: 'packages/invalid/package.json' },
          { packageFile: 'packages/buffer/package.json' },
          { packageFile: 'packages/deleted/package.json' },
          { packageFile: 'packages/not-updated/package.json' },
          {},
        ],
      };

      const result = await generateChangesets(config, packageFiles);

      expect(result).toEqual([
        {
          type: 'addition',
          path: expect.stringMatching(
            /^\.changeset\/renovate-[0-9a-f]{10}\.md$/,
          ),
          contents: `${codeBlock`
            ---
            "@my-org/a": patch
            ---

            Updated dependencies:

            - Updated \`bar\` from \`1.0.0\` to \`2.0.0\`
            - Updated \`foo\` from \`^1.0.0\` to \`^2.0.0\`
            - Added \`new\` at \`1.0.0\`
            - Removed \`old\`
          `}\n`,
        },
        {
          type: 'addition',
          path: expect.stringMatching(
            /^\.changeset\/renovate-[0-9a-f]{10}\.md$/,
          ),
          contents: `${codeBlock`
            ---
            "@my-org/b": major
            ---

            Updated dependencies:

            - Updated \`bar\` from \`1.0.0\` to \`2.0.0\`
            - Updated \`foo\` from \`^1.0.0\` to \`^2.0.0\`
          `}\n`,
        },
        {
          type: 'addition',
          path: expect.stringMatching(
            /^\.changeset\/renovate-[0-9a-f]{10}\.md$/,
          ),
          contents: `${codeBlock`
            ---
            "@my-org/new": patch
            ---

            Updated dependencies:

            - Added \`foo\` at \`^2.0.0\`
          `}\n`,
        },
      ]);
      expect(git.getFile).toHaveBeenCalledWith(
        'packages/a/package.json',
        'main',
      );
      expect(fs.readLocalFile).not.toHaveBeenCalledWith(
        'packages/not-updated/package.json',
        'utf8',
      );
    });

    it('only lists the changes of its packages in each changeset', async () => {
      const before = {
        a: { name: 'a', dependencies: { dep1: '1.0.0', dep2: '1.0.0' } },
        b: { name: 'b', dependencies: { dep2: '1.0.0', dep3: '1.0.0' } },
        c: { name: 'c', dependencies: { dep1: '1.0.0', dep2: '1.0.0' } },
      };
      mockFiles(
        { '.changeset/config.json': '{}' },
        {
          'a/package.json': packageJson(before.a),
          'b/package.json': packageJson(before.b),
          'c/package.json': packageJson(before.c),
        },
      );
      const config = getConfig({
        updatedPackageFiles: [
          updatedPackageJson('a/package.json', {
            name: 'a',
            dependencies: { dep1: '2.0.0', dep2: '2.0.0' },
          }),
          updatedPackageJson('b/package.json', {
            name: 'b',
            dependencies: { dep2: '2.0.0', dep3: '2.0.0' },
          }),
          updatedPackageJson('c/package.json', {
            name: 'c',
            dependencies: { dep2: '2.0.0', dep1: '2.0.0' },
          }),
        ],
      });

      const result = await generateChangesets(
        config,
        getPackageFiles('a/package.json', 'b/package.json', 'c/package.json'),
      );

      expect(result).toMatchObject([
        {
          contents: `${codeBlock`
          ---
          "a": patch
          "c": patch
          ---

          Updated dependencies:

          - Updated \`dep1\` from \`1.0.0\` to \`2.0.0\`
          - Updated \`dep2\` from \`1.0.0\` to \`2.0.0\`
        `}\n`,
        },
        {
          contents: `${codeBlock`
          ---
          "b": patch
          ---

          Updated dependencies:

          - Updated \`dep2\` from \`1.0.0\` to \`2.0.0\`
          - Updated \`dep3\` from \`1.0.0\` to \`2.0.0\`
        `}\n`,
        },
      ]);
      expect(new Set(result.map(({ path }) => path)).size).toBe(2);
    });

    it('lists a dependency once if it changed in several dependency types', async () => {
      mockFiles(
        { '.changeset/config.json': '{}' },
        {
          'package.json': packageJson({
            name: 'lib',
            dependencies: { foo: '^1.0.0' },
            peerDependencies: { foo: '^1.0.0' },
          }),
        },
      );
      const config = getConfig({
        updatedPackageFiles: [
          updatedPackageJson('package.json', {
            name: 'lib',
            dependencies: { foo: '^2.0.0' },
            peerDependencies: { foo: '^2.0.0' },
          }),
        ],
      });

      const result = await generateChangesets(
        config,
        getPackageFiles('package.json'),
      );

      expect(result).toMatchObject([
        {
          contents: `${codeBlock`
            ---
            "lib": major
            ---

            Updated dependencies:

            - Updated \`foo\` from \`^1.0.0\` to \`^2.0.0\`
          `}\n`,
        },
      ]);
    });

    it.each`
      description                        | from                           | to                             | type
      ${'widened'}                       | ${'^18.0.0'}                   | ${'^18.0.0 || ^19.0.0'}        | ${'patch'}
      ${'narrowed'}                      | ${'^18.0.0 || ^19.0.0'}        | ${'^19.0.0'}                   | ${'major'}
      ${'replaced'}                      | ${'^18.0.0'}                   | ${'^19.0.0'}                   | ${'major'}
      ${'added'}                         | ${undefined}                   | ${'^19.0.0'}                   | ${'major'}
      ${'removed'}                       | ${'^18.0.0'}                   | ${undefined}                   | ${'patch'}
      ${'changed to an invalid range'}   | ${'^18.0.0'}                   | ${'github:facebook/react#v19'} | ${'major'}
      ${'changed from an invalid range'} | ${'github:facebook/react#v18'} | ${'^19.0.0'}                   | ${'major'}
    `(
      'bumps $type if a peer dependency is $description',
      async ({ from, to, type }) => {
        mockFiles(
          { '.changeset/config.json': '{}' },
          {
            'package.json': packageJson({
              name: 'lib',
              peerDependencies: { react: from },
            }),
          },
        );
        const config = getConfig({
          updatedPackageFiles: [
            updatedPackageJson('package.json', {
              name: 'lib',
              peerDependencies: { react: to },
            }),
          ],
        });

        const result = await generateChangesets(
          config,
          getPackageFiles('package.json'),
        );

        expect(result).toMatchObject([
          { contents: expect.stringContaining(`"lib": ${type}\n`) },
        ]);
      },
    );

    it('bumps major if any peer dependency change breaks consumers', async () => {
      mockFiles(
        { '.changeset/config.json': '{}' },
        {
          'package.json': packageJson({
            name: 'lib',
            dependencies: { foo: '^1.0.0' },
            peerDependencies: { react: '^18.0.0', vue: '^2.0.0' },
          }),
        },
      );
      const config = getConfig({
        updatedPackageFiles: [
          updatedPackageJson('package.json', {
            name: 'lib',
            dependencies: { foo: '^2.0.0' },
            peerDependencies: { react: '^18.0.0 || ^19.0.0', vue: '^3.0.0' },
          }),
        ],
      });

      const result = await generateChangesets(
        config,
        getPackageFiles('package.json'),
      );

      expect(result).toMatchObject([
        { contents: expect.stringContaining('"lib": major\n') },
      ]);
    });

    it('uses a stable file name for the same changes', async () => {
      mockFiles(
        { '.changeset/config.json': '{}' },
        { 'package.json': packageJson({ name: 'lib', dependencies: {} }) },
      );
      const config = getConfig({
        updatedPackageFiles: [
          updatedPackageJson('package.json', {
            name: 'lib',
            dependencies: { foo: '1.0.0' },
          }),
        ],
      });
      const packageFiles = getPackageFiles('package.json');

      const [first] = await generateChangesets(config, packageFiles);
      const [second] = await generateChangesets(config, packageFiles);

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
          partial<Upgrade<NpmManagerData>>({
            depName: 'foo',
            depType: 'pnpm.catalog.default',
            currentValue: '1.0.0',
            newValue: '1.1.0',
          }),
          partial<Upgrade<NpmManagerData>>({
            depName: 'react',
            depType: 'yarn.catalog.react17',
            currentValue: '17.0.1',
            newValue: '17.0.2',
          }),
          partial<Upgrade<NpmManagerData>>({
            depType: 'pnpm.catalog.default',
          }),
          partial<Upgrade<NpmManagerData>>({
            depName: 'bar',
            depType: 'dependencies',
          }),
          partial<Upgrade<NpmManagerData>>({ depName: 'baz' }),
        ],
      });
      const packageFiles = getPackageFiles(
        'pnpm-workspace.yaml',
        'packages/a/package.json',
        'packages/b/package.json',
        'packages/c/package.json',
      );

      const result = await generateChangesets(config, packageFiles);

      expect(result).toMatchObject([
        {
          contents: `${codeBlock`
            ---
            "a": patch
            ---

            Updated dependencies:

            - Updated \`foo\` (catalog \`default\`) from \`1.0.0\` to \`1.1.0\`
          `}\n`,
        },
        {
          contents: `${codeBlock`
            ---
            "b": major
            ---

            Updated dependencies:

            - Updated \`react\` (catalog \`react17\`) from \`17.0.1\` to \`17.0.2\`
          `}\n`,
        },
      ]);
      expect(git.getFile).not.toHaveBeenCalled();
    });

    it('handles catalog updates without npm package files', async () => {
      mockFiles({ '.changeset/config.json': '{}' });
      const config = getConfig({
        upgrades: [
          partial<Upgrade<NpmManagerData>>({
            depName: 'foo',
            depType: 'pnpm.catalog.default',
          }),
        ],
      });

      await expect(generateChangesets(config, {})).resolves.toEqual([]);
    });
  });
});
