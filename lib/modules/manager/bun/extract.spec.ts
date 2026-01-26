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

  describe('bunfig.toml registry support', () => {
    it('applies default registry from bunfig.toml', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { lodash: '1.0.0' },
        }),
      );
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce(
        'bunfig.toml',
      );
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(`
[install]
registry = "https://registry.example.com"
`);

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);

      expect(packageFiles[0].deps[0].registryUrls).toEqual([
        'https://registry.example.com',
      ]);
    });

    it('applies scoped registry from bunfig.toml', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: {
            lodash: '1.0.0',
            '@myorg/utils': '2.0.0',
          },
        }),
      );
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce(
        'bunfig.toml',
      );
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(`
[install]
registry = "https://registry.example.com"

[install.scopes]
myorg = "https://registry.myorg.com"
`);

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);

      const lodashDep = packageFiles[0].deps.find(
        (d) => d.depName === 'lodash',
      );
      const myorgDep = packageFiles[0].deps.find(
        (d) => d.depName === '@myorg/utils',
      );

      expect(lodashDep?.registryUrls).toEqual(['https://registry.example.com']);
      expect(myorgDep?.registryUrls).toEqual(['https://registry.myorg.com']);
    });

    it('handles missing bunfig.toml gracefully', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { lodash: '1.0.0' },
        }),
      );
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce(null);

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);

      expect(packageFiles[0].deps[0].registryUrls).toBeUndefined();
    });

    it('handles empty bunfig.toml file gracefully', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { lodash: '1.0.0' },
        }),
      );
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce(
        'bunfig.toml',
      );
      // bunfig.toml exists but is empty/null
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(null);

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);

      expect(packageFiles[0].deps[0].registryUrls).toBeUndefined();
    });

    it('applies bunfig.toml registry to workspace packages', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile)
        // Root package.json with workspaces
        .mockResolvedValueOnce(
          JSON.stringify({
            name: 'root',
            version: '1.0.0',
            workspaces: ['packages/*'],
            dependencies: { lodash: '1.0.0' },
          }),
        );
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce(
        'bunfig.toml',
      );
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(`
[install]
registry = "https://registry.example.com"
`);
      vi.mocked(fs.getParentDir).mockReturnValueOnce('');
      // Workspace package.json
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'pkg1',
          version: '1.0.0',
          dependencies: { axios: '2.0.0' },
        }),
      );

      const matchedFiles = [
        'bun.lock',
        'package.json',
        'packages/pkg1/package.json',
      ];

      const packageFiles = await extractAllPackageFiles({}, matchedFiles);

      // Root package should have registry applied
      const rootPkg = packageFiles.find(
        (p) => p.packageFile === 'package.json',
      );
      expect(rootPkg?.deps[0].registryUrls).toEqual([
        'https://registry.example.com',
      ]);

      // Workspace package should also have registry applied
      const workspacePkg = packageFiles.find(
        (p) => p.packageFile === 'packages/pkg1/package.json',
      );
      expect(workspacePkg?.deps[0].registryUrls).toEqual([
        'https://registry.example.com',
      ]);
    });

    it('handles invalid bunfig.toml schema gracefully', async () => {
      vi.mocked(fs.getSiblingFileName).mockReturnValue('package.json');
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: { lodash: '1.0.0' },
        }),
      );
      vi.mocked(fs.findLocalSiblingOrParent).mockResolvedValueOnce(
        'bunfig.toml',
      );
      // Valid TOML but invalid schema (registry should be string or object with url)
      vi.mocked(fs.readLocalFile).mockResolvedValueOnce(`
[install]
registry = 123
`);

      const packageFiles = await extractAllPackageFiles({}, ['bun.lock']);

      expect(packageFiles[0].deps[0].registryUrls).toBeUndefined();
    });
  });
});
