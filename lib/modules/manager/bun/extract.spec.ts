import { codeBlock } from 'common-tags';
import { fs } from '~test/util.ts';
import { coerceObject } from '../../../util/object.ts';
import { stripNpmrc } from '../npm/npmrc.ts';
import type { ExtractConfig } from '../types.ts';
import { extractAllPackageFiles, extractPackageFile } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/bun/extract', () => {
  describe('extractPackageFile()', () => {
    const manifest = JSON.stringify({ dependencies: { foo: '^1.2.0' } });
    const lock = codeBlock`{
      "lockfileVersion": 2,
      "workspaces": { "": { "name": "app" } },
      "packages": {
        "foo": ["foo@1.3.0", "", {}, "integrity"],
        "app/foo": ["foo@9.0.0", "", {}, "integrity"],
      },
    }`;

    it.each([lock, Buffer.from(lock)])(
      'reads the generated lock rather than the manifest range or local file',
      async (contents) => {
        fs.readLocalFile.mockResolvedValue('stale content');

        const result = await extractPackageFile(manifest, 'package.json', {
          lockFiles: ['bun.lock'],
          fileContents: { 'bun.lock': contents },
        });

        expect(result?.deps).toMatchObject([
          { depName: 'foo', currentValue: '^1.2.0', lockedVersion: '1.3.0' },
        ]);
        expect(fs.readLocalFile).not.toHaveBeenCalled();
      },
    );

    it('reads a configured lockfile when no generated content was supplied', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lock);

      const result = await extractPackageFile(manifest, 'app/package.json', {
        lockFiles: ['app/bun.lock'],
      });

      expect(result?.deps[0].lockedVersion).toBe('1.3.0');
      expect(fs.readLocalFile).toHaveBeenCalledWith('app/bun.lock', 'utf8');
    });

    it('resolves workspace-specific scoped aliases and hoisted dependencies', async () => {
      const result = await extractPackageFile(
        JSON.stringify({
          dependencies: { alias: 'npm:@scope/real@^2.0.0', foo: '^1.2.0' },
        }),
        'project/packages/web/package.json',
        {
          lockFiles: ['project/bun.lock'],
          fileContents: {
            'unrelated/bun.lock': lock,
            'project/bun.lock': JSON.stringify({
              lockfileVersion: 1,
              workspaces: { 'packages/web': { name: '@scope/web' } },
              packages: {
                alias: ['@scope/real@1.0.0'],
                '@scope/web/alias': ['@scope/real@2.1.0'],
                foo: ['foo@1.3.0'],
              },
            }),
          },
        },
      );

      expect(result?.deps).toMatchObject([
        { depName: 'alias', lockedVersion: '2.1.0' },
        { depName: 'foo', lockedVersion: '1.3.0' },
      ]);
    });

    it('does not interpret non-registry dependencies as npm versions', async () => {
      const result = await extractPackageFile(
        JSON.stringify({ dependencies: { foo: 'file:../foo' } }),
        'package.json',
        { lockFiles: ['bun.lock'], fileContents: { 'bun.lock': lock } },
      );

      expect(result?.deps).toMatchObject([
        { depName: 'foo', skipReason: 'file' },
      ]);
    });

    it('retains tool versions from the manifest instead of looking them up in the lock', async () => {
      const result = await extractPackageFile(
        JSON.stringify({
          dependencies: { foo: '^1.2.0', empty: '' },
          engines: { node: '^24.0.0', bun: '^1.3.0' },
          packageManager: 'bun@1.3.0',
        }),
        'package.json',
        { lockFiles: ['bun.lock'], fileContents: { 'bun.lock': lock } },
      );

      expect(result?.deps).toMatchObject([
        { depName: 'foo', lockedVersion: '1.3.0' },
        { depName: 'empty', skipReason: 'empty' },
        { depName: 'node', currentValue: '^24.0.0' },
        { depName: 'bun', currentValue: '^1.3.0' },
        { depName: 'bun', currentValue: '1.3.0' },
      ]);
      expect(result?.deps.slice(2).map((dep) => dep.lockedVersion)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    });

    it.each(['invalid', '{', 'null'])(
      'returns null for an invalid manifest: %s',
      async (content) => {
        await expect(
          extractPackageFile(content, 'package.json'),
        ).resolves.toBeNull();
      },
    );

    it('returns null for a non-manifest JSON object', async () => {
      await expect(
        extractPackageFile(
          JSON.stringify({ _id: 1, _args: 1, _from: 1 }),
          'package.json',
        ),
      ).resolves.toBeNull();
    });

    it.each<ExtractConfig>([
      {},
      {
        lockFiles: ['bun.lockb'],
        fileContents: { 'bun.lockb': Buffer.from('binary') },
      },
      { lockFiles: ['bun.lock'] },
      { lockFiles: ['bun.lock'], fileContents: { 'bun.lock': null } },
      { lockFiles: ['bun.lock'], fileContents: { 'bun.lock': 'invalid' } },
      { lockFiles: ['bun.lock'], fileContents: { 'bun.lock': '{}' } },
    ])(
      'returns null when the text lockfile is unavailable or invalid: %j',
      async (config) => {
        await expect(
          extractPackageFile(manifest, 'package.json', config),
        ).resolves.toBeNull();
      },
    );

    it.each([
      { lockfileVersion: 3, workspaces: { '': {} }, packages: {} },
      { lockfileVersion: 2, workspaces: {}, packages: {} },
      { lockfileVersion: 2, workspaces: { '': {} }, packages: { foo: null } },
      { lockfileVersion: 2, workspaces: { '': {} }, packages: {} },
      {
        lockfileVersion: 2,
        workspaces: { '': {} },
        packages: { foo: ['bar@1.3.0'] },
      },
      {
        lockfileVersion: 2,
        workspaces: { '': {} },
        packages: { foo: ['foo@github:owner/repo'] },
      },
    ])(
      'returns null when the lock cannot establish a resolved npm version: %j',
      async (value) => {
        await expect(
          extractPackageFile(manifest, 'package.json', {
            lockFiles: ['bun.lock'],
            fileContents: { 'bun.lock': JSON.stringify(value) },
          }),
        ).resolves.toBeNull();
      },
    );

    it('returns null for a workspace without a name', async () => {
      await expect(
        extractPackageFile(manifest, 'packages/web/package.json', {
          lockFiles: ['bun.lock'],
          fileContents: {
            'bun.lock': JSON.stringify({
              lockfileVersion: 2,
              workspaces: { 'packages/web': {} },
              packages: { foo: ['foo@1.3.0'] },
            }),
          },
        }),
      ).resolves.toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('ignores non-bun files', async () => {
      await expect(
        extractAllPackageFiles({}, ['package.json']),
      ).resolves.toEqual([]);
    });

    describe('when using the .lockb lockfile format', () => {
      it('ignores missing package.json file', async () => {
        await expect(
          extractAllPackageFiles({}, ['bun.lockb']),
        ).resolves.toEqual([]);
      });

      it('ignores invalid package.json file', async () => {
        vi.mocked(fs.readLocalFile).mockResolvedValueOnce('invalid');
        await expect(
          extractAllPackageFiles({}, ['bun.lockb']),
        ).resolves.toEqual([]);
      });

      it('handles null response', async () => {
        fs.getSiblingFileName.mockReturnValueOnce('package.json');
        fs.readLocalFile.mockResolvedValueOnce(
          // This package.json returns null from the extractor
          JSON.stringify({
            _id: 1,
            _args: 1,
            _from: 1,
          }),
        );
        await expect(
          extractAllPackageFiles({}, ['bun.lockb']),
        ).resolves.toEqual([]);
      });

      it('parses valid package.json file', async () => {
        fs.getSiblingFileName.mockReturnValueOnce('package.json');
        fs.readLocalFile.mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            dependencies: {
              dep1: '1.0.0',
            },
          }),
        );
        const packageFiles = await extractAllPackageFiles({}, ['bun.lockb']);
        expect(packageFiles).toMatchObject([
          {
            deps: [
              {
                currentValue: '1.0.0',
                datasource: 'npm',
                depName: 'dep1',
                depType: 'dependencies',
                prettyDepType: 'dependency',
              },
            ],
            extractedConstraints: {},
            lockFiles: ['bun.lockb'],
            managerData: {
              hasPackageManager: false,
              packageJsonName: 'test',
            },
            packageFile: 'package.json',
            packageFileVersion: '0.0.1',
          },
        ]);
      });
    });

    describe('when using the .lock lockfile format', () => {
      it('ignores missing package.json file', async () => {
        await expect(extractAllPackageFiles({}, ['bun.lock'])).resolves.toEqual(
          [],
        );
      });

      it('ignores invalid package.json file', async () => {
        vi.mocked(fs.readLocalFile).mockResolvedValueOnce('invalid');
        await expect(extractAllPackageFiles({}, ['bun.lock'])).resolves.toEqual(
          [],
        );
      });

      it('handles null response', async () => {
        fs.getSiblingFileName.mockReturnValueOnce('package.json');
        fs.readLocalFile.mockResolvedValueOnce(
          // This package.json returns null from the extractor
          JSON.stringify({
            _id: 1,
            _args: 1,
            _from: 1,
          }),
        );
        const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
        expect(packageFiles).toEqual([]);
      });

      it('parses valid package.json file', async () => {
        fs.getSiblingFileName.mockReturnValueOnce('package.json');
        fs.readLocalFile.mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            dependencies: {
              dep1: '1.0.0',
            },
          }),
        );
        await expect(
          extractAllPackageFiles({}, ['bun.lock']),
        ).resolves.toMatchObject([
          {
            deps: [
              {
                currentValue: '1.0.0',
                datasource: 'npm',
                depName: 'dep1',
                depType: 'dependencies',
                prettyDepType: 'dependency',
              },
            ],
            extractedConstraints: {},
            lockFiles: ['bun.lock'],
            managerData: {
              hasPackageManager: false,
              packageJsonName: 'test',
            },
            packageFile: 'package.json',
            packageFileVersion: '0.0.1',
          },
        ]);
      });
    });
  });

  describe('workspaces', () => {
    it('processes workspace package files when workspaces are detected', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');

      vi.mocked(fs.readLocalFile)
        // First call: main package file (with workspaces)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
            workspaces: ['packages/*'],
          }),
        )
        // Second call: workspace package file
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            version: '1.0.0',
            dependencies: { dep2: '2.0.0' },
          }),
        );

      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const matchedFiles = [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ];

      const packageFiles = await extractAllPackageFiles({}, matchedFiles);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['bun.lock'],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          packageFileVersion: '1.0.0',
          lockFiles: ['bun.lock'],
        },
      ]);
    });

    it('adds nothing when no file matches the declared workspaces', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
          workspaces: ['packages/*'],
        }),
      );
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'package.json',
      ]);

      expect(packageFiles).toMatchObject([{ packageFile: 'package.json' }]);
    });

    it('skips a workspace package file that yields nothing', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
            workspaces: ['packages/*'],
          }),
        )
        // the workspace package file cannot be read
        .mockResolvedValueOnce(null);
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([{ packageFile: 'package.json' }]);
    });

    it('skips workspace processing when workspaces is not a valid array', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { dep1: '1.0.0' },
          workspaces: 'invalid',
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['bun.lock'],
          deps: [
            {
              depName: 'dep1',
              currentValue: '1.0.0',
              datasource: 'npm',
              depType: 'dependencies',
              prettyDepType: 'dependency',
            },
          ],
          extractedConstraints: {},
          managerData: {
            hasPackageManager: false,
            packageJsonName: 'test',
          },
        },
      ]);
    });

    it('processes workspace package files when workspaces is an object with packages property', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');

      vi.mocked(fs.readLocalFile)
        // First call: main package file (with workspaces as object)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'my-monorepo',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
            workspaces: {
              packages: ['packages/*'],
            },
          }),
        )
        // Second call: workspace package file
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            version: '1.0.0',
            dependencies: { dep2: '2.0.0' },
          }),
        );

      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const matchedFiles = [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ];

      const packageFiles = await extractAllPackageFiles({}, matchedFiles);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
          lockFiles: ['bun.lock'],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          packageFileVersion: '1.0.0',
          lockFiles: ['bun.lock'],
        },
      ]);
    });
  });

  it.each([false, true])(
    'extracts the devEngines bun constraint with array form: %s',
    async (arrayForm) => {
      const runtime = { name: 'bun', version: '1.4.0' };
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          engines: { bun: '1.2.0' },
          devEngines: {
            runtime: arrayForm ? [runtime] : runtime,
          },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lockb']);

      expect(packageFiles).toMatchObject([
        { extractedConstraints: { bun: '1.4.0' } },
      ]);
    },
  );

  it('extracts .npmrc from sibling or parent directory', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('package.json');
    fs.findLocalSiblingOrParent.mockImplementation(
      (packageFile, configFile): Promise<string | null> => {
        if (packageFile === 'package.json' && configFile === '.npmrc') {
          return Promise.resolve('.npmrc');
        }
        return Promise.resolve(null);
      },
    );
    fs.readLocalFile.mockImplementation((fileName): Promise<any> => {
      if (fileName === '.npmrc') {
        return Promise.resolve('registry=https://custom.registry.com\n');
      }
      if (fileName === 'package.json') {
        return Promise.resolve(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            dependencies: { dep1: '1.0.0' },
          }),
        );
      }
      return Promise.resolve(null);
    });

    const packageFiles = await extractAllPackageFiles({}, ['bun.lockb']);
    expect(packageFiles).toHaveLength(1);
    expect(packageFiles[0].npmrc).toBe(
      'registry=https://custom.registry.com\n',
    );
    expect(packageFiles[0].managerData?.repoNpmrc).toMatchObject({
      fileName: '.npmrc',
      content: 'registry=https://custom.registry.com\n',
    });
    expect(packageFiles[0].managerData?.npmrcFileName).toBe('.npmrc');
  });

  it('marks an unreadable repository .npmrc to be read from disk again', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('package.json');
    fs.findLocalSiblingOrParent.mockResolvedValue('.npmrc');
    fs.readLocalFile
      .mockResolvedValueOnce(
        JSON.stringify({ name: 'test', dependencies: { dep1: '1.0.0' } }),
      )
      .mockResolvedValueOnce(null);

    const packageFiles = await extractAllPackageFiles({}, ['bun.lockb']);

    expect(packageFiles[0]).not.toHaveProperty('npmrc');
    expect(stripNpmrc(packageFiles)[0].managerData).toMatchObject({
      npmrcFileName: '.npmrc',
      uncachedNpmrcFileName: '.npmrc',
    });
  });

  it('does not store a repository .npmrc when there is none', async () => {
    fs.getSiblingFileName.mockReturnValueOnce('package.json');
    fs.findLocalSiblingOrParent.mockResolvedValue(null);
    fs.readLocalFile.mockResolvedValueOnce(
      JSON.stringify({ name: 'test', dependencies: { dep1: '1.0.0' } }),
    );

    const packageFiles = await extractAllPackageFiles({}, ['bun.lockb']);

    expect(packageFiles).toHaveLength(1);
    expect(
      Object.keys(coerceObject(packageFiles[0].managerData)),
    ).not.toContain('repoNpmrc');
    expect(packageFiles[0].managerData?.npmrcFileName).toBeNull();
  });
});
