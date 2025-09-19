import { codeBlock } from 'common-tags';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import {
  collectPackageJson,
  extractAllPackageFiles,
  getLockFiles,
  processDenoExtract,
  processImportMap,
} from './extract';

vi.mock('../../../util/fs');
// used in detectNodeCompatWorkspaces()
vi.mock('find-packages', () => ({
  findPackages: vi.fn(),
}));

describe('modules/manager/deno/extract', () => {
  describe('getLockFiles()', () => {
    it('found lock file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('deno.lock');
      fs.localPathIsFile.mockResolvedValue(true);
      const result = await getLockFiles('deno.lock', 'deno.json');
      expect(result).toEqual(['deno.lock']);
    });

    it('not found lock file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package-lock.json');
      const result = await getLockFiles(false, 'deno.json');
      expect(result).toEqual([]);
    });
  });

  describe('processImportMap()', () => {
    it('importMap', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          imports: {
            dep1: 'jsr:@scope/name@3.0.0',
          },
          scopes: {
            'https://deno.land/x/name/mod.ts': {
              '@scope/name': 'jsr:@scope/name@0.2.0',
            },
          },
        }),
      );
      const result = await processImportMap('import_map.json', 'deno.json', [
        'deno.lock',
      ]);

      expect(result).toStrictEqual({
        deps: [
          {
            currentRawValue: 'jsr:@scope/name@3.0.0',
            currentValue: '3.0.0',
            datasource: 'jsr',
            depName: '@scope/name',
            depType: 'imports',
            versioning: 'deno',
          },
          {
            currentRawValue: 'jsr:@scope/name@0.2.0',
            currentValue: '0.2.0',
            datasource: 'jsr',
            depName: '@scope/name',
            depType: 'scopes',
            versioning: 'deno',
          },
        ],
        lockFiles: ['deno.lock'],
        managerData: {
          importMapReferrer: 'deno.json',
        },
        packageFile: 'import_map.json',
      });
    });

    it('remote importMap', async () => {
      const result = await processImportMap(
        'https://deno.land/x/import_map.json',
        'demo.json',
        [],
      );

      expect(result).toBeNull();
    });

    it('importMap path specified but not exists', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const result = await processImportMap('import_map.json', 'demo.json', []);

      expect(result).toBeNull();
    });

    it('invalid importMap file', async () => {
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      const result = await processImportMap('import_map.json', 'demo.json', []);

      expect(result).toBeNull();
    });
  });

  describe('processDenoExtract()', () => {
    it('importMap', async () => {
      const result = await processDenoExtract({
        content: {
          lock: undefined,
          dependencies: [],
          importMap: 'import_map.json',
          managerData: {
            workspaces: undefined,
          },
        },
        fileName: 'deno.json',
      });
      expect(result).toStrictEqual([
        {
          deps: [],
          lockFiles: [],
          managerData: {
            workspaces: undefined,
          },
          packageFile: 'deno.json',
        },
      ]);
    });
  });

  describe('collectPackageJson()', () => {
    it('node-compat package.json', async () => {
      GlobalConfig.set({ localDir: '' });
      const { findPackages } = await import('find-packages');
      vi.mocked(findPackages).mockResolvedValue([
        { dir: '.', manifest: {}, writeProjectManifest: Promise.resolve },
      ]);
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          dependencies: {
            dep1: '1.0.0',
          },
        }),
      );
      expect(await collectPackageJson('deno.lock')).toEqual([
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
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: undefined,
          },
          packageFile: 'package.json',
        },
      ]);
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('invalid deno.json file', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('deno.json');
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      expect(await extractAllPackageFiles({}, ['deno.json'])).toEqual([]);
    });

    it('complex config with imports, scopes, tasks and lint', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          imports: {
            dep1: 'npm:dep1@1.0.0',
            dep10: 'https://deno.land/x/dep10@v0.1.12/mod.ts',
          },
          scopes: {
            'https://deno.land/x/': {
              dep1: 'npm:dep1@^2.0.0',
            },
          },
          tasks: {
            init: 'deno run -RWE jsr:@scope/dep4@latest',
            dev: {
              command: 'deno run -A --node-modules-dir=auto npm:dep5@6.0.0',
              dependencies: ['init'],
            },
            build: 'deno run -A --node-modules-dir=auto npm:dep6 build',
            changelog: {
              description: 'description',
              command:
                'deno run --allow-read --allow-write https://deno.land/x/dep@v1.0.1/bin.ts',
            },
            joke: 'deno npm:dep7',
            // these should be ignored
            'not-contain-a-datasource': 'deno task npm:example',
            'npm:example': 'deno task jsr:@scope/task',
            'jsr:@scope/task': 'curl http://example.com',
          },
          compilerOptions: {
            types: ['npm:@types/dep1@1.0.0'],
            jsxImportSource: 'npm:dep2@1.0.0',
            jsxImportSourceTypes: 'npm:@types/dep2@1.0.0',
          },
          lint: {
            plugins: [
              'npm:dep3@1.0.0/mod.ts',
              './local_dep.js', // should be ignored
            ],
          },
        }),
      );
      fs.getSiblingFileName.mockReturnValueOnce('deno.lock');
      fs.localPathIsFile.mockResolvedValue(true);
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
        }),
      );
      expect(
        await extractAllPackageFiles({}, ['deno.jsonc', 'deno.lock']),
      ).toStrictEqual([
        {
          deps: [
            {
              currentRawValue: 'npm:dep1@1.0.0',
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep1',
              depType: 'imports',
              versioning: 'deno',
            },
            {
              currentRawValue: 'https://deno.land/x/dep10@v0.1.12/mod.ts',
              currentValue: 'v0.1.12',
              datasource: 'deno',
              depName: 'https://deno.land/x/dep10',
              depType: 'imports',
            },
            {
              currentRawValue: 'npm:dep1@^2.0.0',
              currentValue: '^2.0.0',
              datasource: 'npm',
              depName: 'dep1',
              depType: 'scopes',
              versioning: 'deno',
            },
            {
              currentRawValue: 'jsr:@scope/dep4@latest',
              currentValue: 'latest',
              datasource: 'jsr',
              depName: '@scope/dep4',
              depType: 'tasks',
              versioning: 'deno',
            },
            {
              currentRawValue: 'npm:dep5@6.0.0',
              currentValue: '6.0.0',
              datasource: 'npm',
              depName: 'dep5',
              depType: 'tasks',
              versioning: 'deno',
            },
            {
              currentRawValue: 'npm:dep6',
              currentValue: undefined,
              datasource: 'npm',
              depName: 'dep6',
              depType: 'tasks',
              versioning: 'deno',
            },
            {
              currentRawValue: 'https://deno.land/x/dep@v1.0.1/bin.ts',
              currentValue: 'v1.0.1',
              datasource: 'deno',
              depName: 'https://deno.land/x/dep',
              depType: 'tasks',
            },
            {
              currentRawValue: 'npm:dep7',
              currentValue: undefined,
              datasource: 'npm',
              depName: 'dep7',
              depType: 'tasks',
              versioning: 'deno',
            },
            {
              depName: 'deno task npm:example',
              depType: 'tasks',
              skipReason: 'unsupported',
              skipStage: 'extract',
            },
            {
              depName: 'deno task jsr:@scope/task',
              depType: 'tasks',
              skipReason: 'unsupported',
              skipStage: 'extract',
            },
            {
              depName: 'curl http://example.com',
              depType: 'tasks',
              skipReason: 'unsupported',
              skipStage: 'extract',
            },
            {
              currentRawValue: 'npm:@types/dep1@1.0.0',
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: '@types/dep1',
              depType: 'compilerOptions',
              versioning: 'deno',
            },
            {
              currentRawValue: 'npm:dep2@1.0.0',
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep2',
              depType: 'compilerOptions',
              versioning: 'deno',
            },
            {
              currentRawValue: 'npm:@types/dep2@1.0.0',
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: '@types/dep2',
              depType: 'compilerOptions',
              versioning: 'deno',
            },
            {
              currentRawValue: 'npm:dep3@1.0.0/',
              currentValue: '1.0.0',
              datasource: 'npm',
              depName: 'dep3',
              depType: 'lint',
              versioning: 'deno',
            },
            {
              depName: './local_dep.js',
              depType: 'lint',
              skipReason: 'unsupported',
              skipStage: 'extract',
            },
          ],
          lockFiles: ['deno.lock'],
          managerData: {
            workspaces: undefined,
          },
          packageFile: 'deno.jsonc',
        },
      ]);
    });

    // workspace tests
    describe('workspaces', () => {
      it('npm workspace compatible', async () => {
        GlobalConfig.set({ localDir: '' });
        const { findPackages } = await import('find-packages');
        vi.mocked(findPackages).mockResolvedValue([
          {
            dir: 'sub',
            manifest: { name: 'sub' },
            writeProjectManifest: Promise.resolve,
          },
        ]);
        fs.getSiblingFileName.mockReturnValue('package.json');
        fs.readLocalFile.mockImplementation((fileName) => {
          if (fileName === 'package.json') {
            return Promise.resolve(codeBlock`
              {
                "name": "root",
                "version": "0.0.1",
                "dependencies": {
                  "dep1": "1.0.0"
                },
                "workspaces": [
                  "sub"
                ]
              }
            `);
          }
          if (fileName === 'sub/package.json') {
            return Promise.resolve(codeBlock`
              {
                "name": "sub",
                "version": "0.0.2",
                "dependencies": {
                  "dep2": "2.0.0"
                }
              }
            `);
          }
          if (fileName === 'deno.lock') {
            return Promise.resolve(codeBlock`
              {
                "version": "5",
                "specifiers": {
                  "npm:dep1@1.0.0": "1.0.0",
                  "npm:dep2@2.0.0": "2.0.0"
                }
              }
            `);
          }
          return Promise.resolve(null);
        });
        fs.localPathIsFile.mockImplementation((fileName) => {
          return Promise.resolve(
            fileName === 'package.json' ||
              fileName === 'sub/package.json' ||
              fileName === 'deno.lock',
          );
        });

        expect(await extractAllPackageFiles({}, ['deno.lock'])).toStrictEqual([
          {
            deps: [
              {
                currentValue: '1.0.0',
                datasource: 'npm',
                depName: 'dep1',
                depType: 'dependencies',
                prettyDepType: 'dependency',
                lockedVersion: '1.0.0',
              },
            ],
            managerData: {
              packageName: 'root',
              workspaces: ['sub'],
            },
            extractedConstraints: {},
            lockFiles: ['deno.lock'],
            packageFile: 'package.json',
            packageFileVersion: '0.0.1',
          },
          {
            deps: [
              {
                currentValue: '2.0.0',
                datasource: 'npm',
                depName: 'dep2',
                depType: 'dependencies',
                lockedVersion: '2.0.0',
                prettyDepType: 'dependency',
              },
            ],
            managerData: {
              packageName: 'sub',
              workspaces: undefined,
            },
            extractedConstraints: {},
            lockFiles: ['deno.lock'],
            packageFile: 'sub/package.json',
            packageFileVersion: '0.0.2',
          },
        ]);
      });
    });
  });
});
