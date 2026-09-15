import { codeBlock } from 'common-tags';
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

  describe('bunfig.toml registry support', () => {
    const packageJson = JSON.stringify({
      name: 'test',
      version: '0.0.1',
      dependencies: { lodash: '1.0.0', '@myorg/utils': '2.0.0' },
    });

    it('applies the default registry', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [install]
        registry = "https://registry.example.com"
      `);
      fs.readLocalFile.mockResolvedValueOnce(packageJson);

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'bunfig.toml',
      ]);

      expect(packageFiles).toMatchObject([
        {
          deps: [
            {
              depName: 'lodash',
              registryUrls: ['https://registry.example.com'],
            },
            {
              depName: '@myorg/utils',
              registryUrls: ['https://registry.example.com'],
            },
          ],
        },
      ]);
    });

    it('applies scoped registries', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [install]
        registry = "https://registry.example.com"

        [install.scopes]
        myorg = "https://registry.myorg.com"
      `);
      fs.readLocalFile.mockResolvedValueOnce(packageJson);

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'bunfig.toml',
      ]);

      expect(packageFiles).toMatchObject([
        {
          deps: [
            {
              depName: 'lodash',
              registryUrls: ['https://registry.example.com'],
            },
            {
              depName: '@myorg/utils',
              registryUrls: ['https://registry.myorg.com'],
            },
          ],
        },
      ]);
    });

    it('ignores an invalid bunfig.toml file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [install]
        registry = 123
      `);
      fs.readLocalFile.mockResolvedValueOnce(packageJson);

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'bunfig.toml',
      ]);

      expect(packageFiles[0].deps[0].registryUrls).toBeUndefined();
    });

    it('ignores a bunfig.toml file which is not next to the lock file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(packageJson);

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'packages/pkg1/bunfig.toml',
      ]);

      expect(packageFiles[0].deps[0].registryUrls).toBeUndefined();
    });

    it('applies the workspace root registries to workspace packages', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
        [install]
        registry = "https://registry.example.com"
      `);
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'root',
          version: '1.0.0',
          workspaces: ['packages/*'],
          dependencies: { lodash: '1.0.0' },
        }),
      );
      fs.getParentDir.mockReturnValueOnce('');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'pkg1',
          version: '1.0.0',
          dependencies: { axios: '2.0.0' },
        }),
      );

      const packageFiles = await extractAllPackageFiles({}, [
        'bun.lock',
        'bunfig.toml',
        'package.json',
        'packages/pkg1/package.json',
      ]);

      expect(packageFiles).toMatchObject([
        {
          packageFile: 'package.json',
          deps: [
            {
              depName: 'lodash',
              registryUrls: ['https://registry.example.com'],
            },
          ],
        },
        {
          packageFile: 'packages/pkg1/package.json',
          deps: [
            {
              depName: 'axios',
              registryUrls: ['https://registry.example.com'],
            },
          ],
        },
      ]);
    });
  });
});
