import { extractAllPackageFiles } from './extract';
import { fs } from '~test/util';

vi.mock('../../../util/fs');

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
  });

  describe('catalogs', () => {
    it('extracts catalog dependencies from root package.json', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          workspaces: {
            packages: ['packages/*'],
            catalog: {
              react: '^18.0.0',
              'react-dom': '^18.0.0',
            },
            catalogs: {
              testing: {
                jest: '29.0.0',
                'testing-library': '13.0.0',
              },
            },
          },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          deps: [
            {
              depName: 'react',
              currentValue: '^18.0.0',
              datasource: 'npm',
              depType: 'bun.catalog.default',
              prettyDepType: 'bun.catalog.default',
            },
            {
              depName: 'react-dom',
              currentValue: '^18.0.0',
              datasource: 'npm',
              depType: 'bun.catalog.default',
              prettyDepType: 'bun.catalog.default',
            },
            {
              depName: 'jest',
              currentValue: '29.0.0',
              datasource: 'npm',
              depType: 'bun.catalog.testing',
              prettyDepType: 'bun.catalog.testing',
            },
            {
              depName: 'testing-library',
              currentValue: '13.0.0',
              datasource: 'npm',
              depType: 'bun.catalog.testing',
              prettyDepType: 'bun.catalog.testing',
            },
          ],
          managerData: {
            packageJsonName: 'test',
          },
        },
      ]);
    });

    it('resolves catalog references in workspace packages', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.getParentDir).mockReturnValue('');

      vi.mocked(fs.readLocalFile)
        // First call: main package file (with catalogs)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            workspaces: {
              packages: ['packages/*'],
              catalog: {
                react: '^18.0.0',
                'react-dom': '^18.0.0',
              },
              catalogs: {
                testing: {
                  jest: '29.0.0',
                },
              },
            },
          }),
        )
        // Second call: workspace package file (with catalog references)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            version: '1.0.0',
            dependencies: {
              react: 'catalog:',
              'react-dom': 'catalog:',
            },
            devDependencies: {
              jest: 'catalog:testing',
            },
          }),
        );

      const matchedFiles = [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ];

      const packageFiles = await extractAllPackageFiles({}, matchedFiles);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          deps: [
            {
              depType: 'bun.catalog.default',
              depName: 'react',
              currentValue: '^18.0.0',
            },
            {
              depType: 'bun.catalog.default',
              depName: 'react-dom',
              currentValue: '^18.0.0',
            },
            {
              depType: 'bun.catalog.testing',
              depName: 'jest',
              currentValue: '29.0.0',
            },
          ],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          deps: [
            {
              depName: 'react',
              depType: 'bun.catalog.default',
              currentValue: '^18.0.0',
              prettyDepType: 'bun.catalog.default',
            },
            {
              depName: 'react-dom',
              depType: 'bun.catalog.default',
              currentValue: '^18.0.0',
              prettyDepType: 'bun.catalog.default',
            },
            {
              depName: 'jest',
              depType: 'bun.catalog.testing',
              currentValue: '29.0.0',
              prettyDepType: 'bun.catalog.testing',
            },
          ],
        },
      ]);
    });

    it('handles missing catalog references gracefully', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.getParentDir).mockReturnValue('');

      vi.mocked(fs.readLocalFile)
        // First call: main package file (with catalogs)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'test',
            version: '0.0.1',
            workspaces: {
              packages: ['packages/*'],
              catalog: {
                react: '^18.0.0',
              },
            },
          }),
        )
        // Second call: workspace package file (with invalid catalog reference)
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'pkg1',
            version: '1.0.0',
            dependencies: {
              'non-existent': 'catalog:',
            },
          }),
        );

      const matchedFiles = [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ];

      const packageFiles = await extractAllPackageFiles({}, matchedFiles);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          deps: [
            {
              depType: 'bun.catalog.default',
              depName: 'react',
              currentValue: '^18.0.0',
            },
          ],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          deps: [
            {
              depName: 'non-existent',
              depType: 'bun.catalog.default',
              currentValue: 'catalog:default',
              prettyDepType: 'bun.catalog.default',
            },
          ],
        },
      ]);
    });

    it('does not extract catalogs when none are present', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          workspaces: {
            packages: ['packages/*'],
          },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          deps: [],
          managerData: {
            packageJsonName: 'test',
          },
        },
      ]);
    });
  });
});
