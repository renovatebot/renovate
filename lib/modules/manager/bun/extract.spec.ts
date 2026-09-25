import { fs } from '~test/util.ts';
import { extractAllPackageFiles } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/bun/extract', () => {
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
  });

  describe('catalogs', () => {
    it('ignores invalid catalog values', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          dependencies: { dep1: '1.0.0' },
          catalog: 'not-an-object',
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].deps).toMatchObject([
        { depType: 'dependencies', depName: 'dep1', currentValue: '1.0.0' },
      ]);
    });

    it('keeps valid catalog entries when some values are malformed', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          catalog: { react: '^19.0.0', broken: 42 },
          catalogs: { testing: { jest: '30.0.0' }, invalid: 'not-an-object' },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].deps).toMatchObject([
        { depType: 'bun.catalog.default', depName: 'react' },
        { depType: 'bun.catalog.testing', depName: 'jest' },
      ]);
      expect(packageFiles[0].deps).toHaveLength(2);
    });

    it('extracts top-level catalogs from root package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          dependencies: { dep1: '1.0.0' },
          catalog: { react: '^19.0.0' },
          catalogs: { testing: { jest: '30.0.0' } },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].deps).toMatchObject([
        { depType: 'dependencies', depName: 'dep1', currentValue: '1.0.0' },
        {
          depType: 'bun.catalog.default',
          depName: 'react',
          currentValue: '^19.0.0',
          prettyDepType: 'bun.catalog.default',
        },
        {
          depType: 'bun.catalog.testing',
          depName: 'jest',
          currentValue: '30.0.0',
          prettyDepType: 'bun.catalog.testing',
        },
      ]);
    });

    it('extracts catalogs nested under workspaces object', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          workspaces: {
            packages: ['packages/*'],
            catalog: { react: '^19.0.0' },
            catalogs: { testing: { jest: '30.0.0' } },
          },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].deps).toMatchObject([
        {
          depType: 'bun.catalog.default',
          depName: 'react',
          currentValue: '^19.0.0',
        },
        {
          depType: 'bun.catalog.testing',
          depName: 'jest',
          currentValue: '30.0.0',
        },
      ]);
    });

    it('does not extract catalogs from workspace packages', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'my-monorepo',
            workspaces: ['packages/*'],
            catalog: { react: '^19.0.0' },
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            dependencies: { react: 'catalog:' },
            catalog: { lodash: '4.17.21' },
          }),
        );
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          deps: [{ depType: 'bun.catalog.default', depName: 'react' }],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          deps: [{ depType: 'dependencies', depName: 'react' }],
        },
      ]);
    });

    it('skips workspace packages that fail to parse', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile)
        .mockResolvedValueOnce(
          JSON.stringify({ name: 'my-monorepo', workspaces: ['packages/*'] }),
        )
        .mockResolvedValueOnce('invalid json');
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([{ packageFile: 'package.json' }]);
    });
  });
});
