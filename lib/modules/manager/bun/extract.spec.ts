import { fs } from '~test/util.ts';
import { bunCatalogsToArray, extractAllPackageFiles } from './extract.ts';

vi.mock('../../../util/fs/index.ts');

describe('modules/manager/bun/extract', () => {
  describe('extractAllPackageFiles()', () => {
    it('ignores non-bun files', async () => {
      expect(await extractAllPackageFiles({}, ['package.json'])).toEqual([]);
    });

    describe('when using the .lockb lockfile format', () => {
      it('ignores missing package.json file', async () => {
        expect(await extractAllPackageFiles({}, ['bun.lockb'])).toEqual([]);
      });

      it('ignores invalid package.json file', async () => {
        vi.mocked(fs.readLocalFile).mockResolvedValueOnce('invalid');
        expect(await extractAllPackageFiles({}, ['bun.lockb'])).toEqual([]);
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
        expect(await extractAllPackageFiles({}, ['bun.lockb'])).toEqual([]);
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
        expect(await extractAllPackageFiles({}, ['bun.lock'])).toEqual([]);
      });

      it('ignores invalid package.json file', async () => {
        vi.mocked(fs.readLocalFile).mockResolvedValueOnce('invalid');
        expect(await extractAllPackageFiles({}, ['bun.lock'])).toEqual([]);
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
        expect(await extractAllPackageFiles({}, ['bun.lock'])).toMatchObject([
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

  describe('bunCatalogsToArray()', () => {
    it('extracts top-level default catalog', () => {
      const result = bunCatalogsToArray({
        catalog: { react: '^19.0.0', 'react-dom': '^19.0.0' },
      });
      expect(result).toEqual([
        {
          name: 'default',
          dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
        },
      ]);
    });

    it('extracts top-level named catalogs', () => {
      const result = bunCatalogsToArray({
        catalogs: {
          testing: { jest: '30.0.0' },
          build: { webpack: '5.88.2' },
        },
      });
      expect(result).toEqual([
        { name: 'testing', dependencies: { jest: '30.0.0' } },
        { name: 'build', dependencies: { webpack: '5.88.2' } },
      ]);
    });

    it('extracts catalogs under workspaces object', () => {
      const result = bunCatalogsToArray({
        workspaces: {
          packages: ['packages/*'],
          catalog: { react: '^19.0.0' },
          catalogs: { testing: { jest: '30.0.0' } },
        },
      });
      expect(result).toEqual([
        { name: 'default', dependencies: { react: '^19.0.0' } },
        { name: 'testing', dependencies: { jest: '30.0.0' } },
      ]);
    });

    it('prefers top-level over workspaces-nested when both exist', () => {
      const result = bunCatalogsToArray({
        catalog: { react: '^19.0.0' },
        workspaces: {
          packages: ['packages/*'],
          catalog: { react: '^18.0.0' },
        },
      });
      // Top-level takes precedence (??= only fills if undefined)
      expect(result).toEqual([
        { name: 'default', dependencies: { react: '^19.0.0' } },
      ]);
    });

    it('returns empty array when no catalogs present', () => {
      const result = bunCatalogsToArray({
        name: 'my-app',
        dependencies: { dep1: '1.0.0' },
      });
      expect(result).toEqual([]);
    });

    it('returns both default and named catalogs', () => {
      const result = bunCatalogsToArray({
        catalog: { react: '^19.0.0' },
        catalogs: { testing: { jest: '30.0.0' } },
      });
      expect(result).toEqual([
        { name: 'default', dependencies: { react: '^19.0.0' } },
        { name: 'testing', dependencies: { jest: '30.0.0' } },
      ]);
    });

    it('ignores invalid catalog values', () => {
      const result = bunCatalogsToArray({
        catalog: 'not-an-object',
        catalogs: { valid: { dep: '1.0.0' }, invalid: 'not-an-object' },
      });
      expect(result).toEqual([
        { name: 'valid', dependencies: { dep: '1.0.0' } },
      ]);
    });
  });

  describe('catalogs', () => {
    it('extracts top-level catalog dependencies from root package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          version: '1.0.0',
          dependencies: { dep1: '1.0.0' },
          catalog: { react: '^19.0.0', 'react-dom': '^19.0.0' },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].deps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            depType: 'dependencies',
            depName: 'dep1',
            currentValue: '1.0.0',
          }),
          expect.objectContaining({
            depType: 'bun.catalog.default',
            depName: 'react',
            currentValue: '^19.0.0',
            prettyDepType: 'bun.catalog.default',
          }),
          expect.objectContaining({
            depType: 'bun.catalog.default',
            depName: 'react-dom',
            currentValue: '^19.0.0',
            prettyDepType: 'bun.catalog.default',
          }),
        ]),
      );
    });

    it('extracts named catalog dependencies', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          version: '1.0.0',
          catalogs: {
            testing: { jest: '30.0.0', vitest: '1.0.0' },
          },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].deps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            depType: 'bun.catalog.testing',
            depName: 'jest',
            currentValue: '30.0.0',
            prettyDepType: 'bun.catalog.testing',
          }),
          expect.objectContaining({
            depType: 'bun.catalog.testing',
            depName: 'vitest',
            currentValue: '1.0.0',
            prettyDepType: 'bun.catalog.testing',
          }),
        ]),
      );
    });

    it('extracts catalogs nested under workspaces object', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'my-monorepo',
          version: '1.0.0',
          workspaces: {
            packages: ['packages/*'],
            catalog: { react: '^19.0.0' },
            catalogs: { testing: { jest: '30.0.0' } },
          },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);
      expect(packageFiles).toHaveLength(1);
      expect(packageFiles[0].deps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            depType: 'bun.catalog.default',
            depName: 'react',
            currentValue: '^19.0.0',
          }),
          expect.objectContaining({
            depType: 'bun.catalog.testing',
            depName: 'jest',
            currentValue: '30.0.0',
          }),
        ]),
      );
    });

    it('does not extract catalogs from workspace sub-packages', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');

      vi.mocked(fs.readLocalFile)
        // Root package file
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'my-monorepo',
            version: '1.0.0',
            workspaces: ['packages/*'],
            catalog: { react: '^19.0.0' },
          }),
        )
        // Sub-package with its own catalog field (should be ignored)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            version: '1.0.0',
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

      // Root should have catalog deps
      const rootFile = packageFiles.find(
        (f) => f.packageFile === 'package.json',
      );
      expect(rootFile?.deps).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            depType: 'bun.catalog.default',
            depName: 'react',
            currentValue: '^19.0.0',
          }),
        ]),
      );

      // Sub-package should NOT have catalog deps extracted
      const subFile = packageFiles.find(
        (f) => f.packageFile === 'packages/pkg1/package.json',
      );
      const subCatalogDeps = subFile?.deps.filter((d) =>
        d.depType?.startsWith('bun.catalog.'),
      );
      expect(subCatalogDeps).toEqual([]);
    });
  });
});
