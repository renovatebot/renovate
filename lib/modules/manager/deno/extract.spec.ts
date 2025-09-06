import { codeBlock } from 'common-tags';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import {
  collectPackageJson,
  extractAllPackageFiles,
  extractDenoJsonFile,
  extractJsrDatasource,
  extractNpmDatasource,
  getDenoDependency,
} from './extract';

vi.mock('../../../util/fs');
// used in detectNodeCompatWorkspaces()
vi.mock('find-packages', () => ({
  findPackages: vi.fn(),
}));

describe('modules/manager/deno/extract', () => {
  describe('extractNpmDatasource()', () => {
    it('extracts valid npm datasource', () => {
      const result = extractNpmDatasource(
        'npm',
        // @ts-expect-error testing purpose
        'dependencies',
        'dep1',
        '1.0.0',
      );
      expect(result).toEqual({
        datasource: 'npm',
        versioning: 'deno',
        depName: 'dep1',
        currentValue: '1.0.0',
        depType: 'dependencies',
      });
    });

    it('skips invalid npm package names', () => {
      const result = extractNpmDatasource(
        'npm',
        // @ts-expect-error testing purpose
        'dependencies',
        '_test',
        '1.0.0',
      );
      expect(result).toEqual({
        datasource: 'npm',
        versioning: 'deno',
        skipReason: 'invalid-name',
      });
    });

    it('skips invalid npm package versions', () => {
      const result = extractNpmDatasource(
        'npm',
        // @ts-expect-error testing purpose
        'dependencies',
        'dep1',
        'INVALID',
      );
      expect(result).toEqual({
        datasource: 'npm',
        versioning: 'deno',
        skipReason: 'invalid-version',
      });
    });
  });

  describe('extractJsrDatasource()', () => {
    it('extracts valid jsr datasource', () => {
      const result = extractJsrDatasource(
        'jsr',
        'imports',
        '@scope/name',
        '1.0.0',
      );
      expect(result).toEqual({
        datasource: 'jsr',
        versioning: 'deno',
        depName: '@scope/name',
        currentValue: '1.0.0',
        depType: 'imports',
      });
    });

    it('skips invalid jsr package names', () => {
      const result = extractJsrDatasource(
        'jsr',
        'imports',
        '@@scope/name',
        '1.0.0',
      );
      expect(result).toEqual({
        datasource: 'jsr',
        versioning: 'deno',
        skipReason: 'invalid-name',
      });
    });

    it('skips invalid jsr package versions', () => {
      const result = extractJsrDatasource(
        'jsr',
        'imports',
        '@scope/name',
        'INVALID',
      );
      expect(result).toEqual({
        datasource: 'jsr',
        versioning: 'deno',
        skipReason: 'invalid-version',
      });
    });
  });

  describe('getDenoDependency()', () => {
    it('unsupported data source', () => {
      const result = getDenoDependency(
        'jsr:@scope/name',
        'imports',
        new Set(['foo']),
      );
      expect(result).toBeNull();
    });
    it('unsupported depType', () => {
      const result = getDenoDependency(
        'jsr:@scope/name',
        // @ts-expect-error testing purpose
        'unsupported',
      );
      expect(result).toBeNull();
    });
  });

  describe('extractDenoJsonFile()', () => {
    it('empty workspace', async () => {
      const result = await extractDenoJsonFile(
        {
          workspace: [],
        },
        'deno.json',
      );
      expect(result).toEqual([
        {
          deps: [],
          lockFiles: [],
          managerData: {
            workspaces: [],
          },
          packageFile: 'deno.json',
        },
      ]);
    });

    it('lock is string', async () => {
      fs.localPathIsFile.mockResolvedValue(true);
      const result = await extractDenoJsonFile(
        {
          lock: 'deno.lock',
        },
        'deno.json',
      );
      expect(result).toEqual([
        {
          deps: [],
          lockFiles: ['deno.lock'],
          packageFile: 'deno.json',
        },
      ]);
    });

    it('lock is object', async () => {
      fs.localPathIsFile.mockResolvedValue(true);
      const result = await extractDenoJsonFile(
        {
          lock: {
            path: 'genuine-deno.lock',
          },
        },
        'deno.json',
      );
      expect(result).toEqual([
        {
          deps: [],
          lockFiles: ['genuine-deno.lock'],
          packageFile: 'deno.json',
        },
      ]);
    });

    it('workspace has members field', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const result = await extractDenoJsonFile(
        {
          workspace: {
            members: ['member1', 'member2'],
          },
        },
        'deno.json',
      );
      expect(result).toEqual([
        {
          deps: [],
          lockFiles: [],
          managerData: {
            workspaces: ['member1', 'member2'],
          },
          packageFile: 'deno.json',
        },
      ]);
    });

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
      fs.getSiblingFileName.mockReturnValueOnce('deno.lock');
      fs.localPathIsFile.mockResolvedValue(true);
      const result = await extractDenoJsonFile(
        {
          name: 'test',
          version: '0.0.1',
          importMap: 'import_map.json',
        },
        'deno.json',
      );
      expect(result).toStrictEqual([
        {
          deps: [],
          lockFiles: ['deno.lock'],
          managerData: {
            packageName: 'test',
          },
          packageFile: 'deno.json',
          packageFileVersion: '0.0.1',
        },
        {
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
          packageFile: 'import_map.json',
        },
      ]);
    });

    it('remote importMap', async () => {
      const result = await extractDenoJsonFile(
        {
          importMap: 'https://deno.land/x/import_map.json',
        },
        'deno.json',
      );
      expect(result).toEqual([
        {
          deps: [],
          lockFiles: [],
          packageFile: 'deno.json',
        },
      ]);
    });

    it('importMap path specified but not exists', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const result = await extractDenoJsonFile(
        {
          importMap: 'import_map.json',
        },
        'deno.json',
      );
      expect(result).toEqual([
        {
          deps: [],
          lockFiles: [],
          packageFile: 'deno.json',
        },
      ]);
    });

    it('importMap field is ignored when imports or scopes are specified in the config file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          imports: {
            dep1: 'jsr:@scope/name@3.0.0',
          },
        }),
      );
      fs.getSiblingFileName.mockReturnValueOnce('deno.lock');
      fs.localPathIsFile.mockResolvedValue(true);
      const result = await extractDenoJsonFile(
        {
          name: 'test',
          version: '0.0.1',
          scopes: {
            'https://deno.land/x/name/mod.ts': {
              '@scope/name': 'jsr:@scope/name@0.2.0',
            },
          },
          importMap: 'import_map.json',
        },
        'deno.json',
      );
      expect(result).toStrictEqual([
        {
          deps: [
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
            packageName: 'test',
          },
          packageFile: 'deno.json',
          packageFileVersion: '0.0.1',
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
          name: 'test',
          version: '0.0.1',
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
            packageName: 'test',
            workspaces: undefined,
          },
          packageFile: 'package.json',
          packageFileVersion: '0.0.1',
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
          name: 'test',
          version: '0.0.1',
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
          ],
          lockFiles: ['deno.lock'],
          managerData: {
            packageName: 'test',
          },
          packageFile: 'deno.jsonc',
          packageFileVersion: '0.0.1',
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
              workspaces: ['sub'],
            },
            extractedConstraints: {},
            lockFiles: ['deno.lock'],
            packageFile: 'package.json',
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
