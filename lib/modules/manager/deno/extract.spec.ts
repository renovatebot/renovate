import { fs, getFixturePath } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import {
  collectPackageJson,
  extractAllPackageFiles,
  extractDenoCompatiblePackageJson,
  extractDenoJsonFile,
  extractJsrDatasource,
  extractNpmDatasource,
  getDenoDependency,
  getDenoLock,
  getLockedVersion,
} from './extract';

vi.mock('../../../util/fs');

describe('modules/manager/deno/extract', () => {
  describe('getDenoLock()', () => {
    it('empty lock file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(JSON.stringify({}));
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({});
    });
    it('not supported version', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '4',
          specifiers: {
            'jsr:@scope/name@1': '1.0.0',
          },
        }),
      );
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({});
    });
    it('invalid key of specifiers', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: '5',
          specifiers: {
            'jsr:@scope/name@*':
              '7.1.3_jsr:@scope+name@4.0.3_@types+pkgname@1.0.1',
          },
        }),
      );
      const result = await getDenoLock('deno.lock');
      expect(result).toMatchObject({
        lockfileVersion: 5,
        lockedVersions: {
          'jsr:@scope/name@*': '7.1.3',
        },
      });
    });
  });

  describe('getLockedVersion()', () => {
    it('empty lock file', () => {
      const result = getLockedVersion({}, {});
      expect(result).toBeNull();
    });
    it('invalid datasource', () => {
      const result = getLockedVersion(
        {
          datasource: 'invalid',
          currentRawValue: 'invalid:@scope/name*',
          currentValue: '1.0.0',
          depName: 'invalid:@scope/name',
        },
        {
          lockfileVersion: 5,
          lockedVersions: {
            'invalid:@scope/name*': '1.0.0',
          },
        },
      );
      expect(result).toBeNull();
    });
    it('invalid lock file content', () => {
      const result = getLockedVersion(
        {
          datasource: 'npm',
          currentValue: '1.0.0',
          depName: 'npm:@scope/name',
        },
        {
          lockfileVersion: 5,
          lockedVersions: {
            INVALID_KEY: '1.0.0',
          },
        },
      );
      expect(result).toBeNull();
    });
  });

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
      expect(result).toEqual({
        deps: [],
        lockFiles: [],
        managerData: {
          workspaces: [],
        },
        packageFile: 'deno.json',
      });
    });

    it('lock is string', async () => {
      fs.localPathIsFile.mockResolvedValue(true);
      const result = await extractDenoJsonFile(
        {
          lock: 'deno.lock',
        },
        'deno.json',
      );
      expect(result).toEqual({
        deps: [],
        lockFiles: ['deno.lock'],
        managerData: {
          packageName: undefined,
        },
        packageFileVersion: undefined,
        packageFile: 'deno.json',
      });
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
      expect(result).toEqual({
        deps: [],
        lockFiles: ['genuine-deno.lock'],
        managerData: {
          packageName: undefined,
        },
        packageFileVersion: undefined,
        packageFile: 'deno.json',
      });
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
          packageName: 'test',
        },
        packageFile: 'import_map.json',
        packageFileVersion: '0.0.1',
      });
    });

    it('remote importMap', async () => {
      const result = await extractDenoJsonFile(
        {
          importMap: 'https://deno.land/x/import_map.json',
        },
        'deno.json',
      );
      expect(result).toEqual({
        deps: [],
        lockFiles: [],
        managerData: {
          packageName: undefined,
        },
        packageFile: 'deno.json',
        packageFileVersion: undefined,
      });
    });

    it('importMap path specified but not exists', async () => {
      fs.readLocalFile.mockResolvedValueOnce(null);
      const result = await extractDenoJsonFile(
        {
          importMap: 'import_map.json',
        },
        'deno.json',
      );
      expect(result).toEqual({
        deps: [],
        lockFiles: [],
        managerData: {
          packageName: undefined,
        },
        packageFile: 'deno.json',
        packageFileVersion: undefined,
      });
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
      expect(result).toStrictEqual({
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
      });
    });
  });

  describe('extractDenoCompatiblePackageJson()', () => {
    it('not supported remote datasource in package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          name: 'test',
          version: '0.0.1',
          dependencies: {
            r: 'github:owner/r#semver:^1.0.0',
            n: 'git+https://github.com/owner/n#v2.0.0',
          },
        }),
      );
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toEqual({
        deps: [
          {
            currentRawValue: 'github:owner/r#semver:^1.0.0',
            currentValue: '^1.0.0',
            datasource: 'github-tags',
            depName: 'r',
            depType: 'dependencies',
            gitRef: true,
            packageName: 'owner/r',
            pinDigests: false,
            prettyDepType: 'dependency',
            skipReason: 'unsupported-remote',
            sourceUrl: 'https://github.com/owner/r',
            versioning: 'npm',
          },
          {
            currentRawValue: 'git+https://github.com/owner/n#v2.0.0',
            currentValue: 'v2.0.0',
            datasource: 'github-tags',
            depName: 'n',
            depType: 'dependencies',
            gitRef: true,
            packageName: 'owner/n',
            pinDigests: false,
            prettyDepType: 'dependency',
            skipReason: 'unsupported-remote',
            sourceUrl: 'https://github.com/owner/n',
            versioning: 'npm',
          },
        ],
        extractedConstraints: {},
        managerData: {
          packageName: 'test',
          workspaces: undefined,
        },
        packageFile: 'package.json',
        packageFileVersion: '0.0.1',
      });
    });

    it('invalid package.json', async () => {
      fs.getSiblingFileName.mockReturnValueOnce('package.json');
      fs.readLocalFile.mockResolvedValueOnce('invalid');
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
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
      const result = await extractDenoCompatiblePackageJson('package.json');
      expect(result).toBeNull();
    });
  });

  describe('collectPackageJson()', () => {
    it('detects npm-compatible deno', async () => {
      GlobalConfig.set({ localDir: '' });
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
      beforeEach(async () => {
        vi.restoreAllMocks();
        const realFs =
          await vi.importActual<typeof import('../../../util/fs')>(
            '../../../util/fs',
          );

        fs.getSiblingFileName.mockImplementation(realFs.getSiblingFileName);
        fs.readLocalFile.mockImplementation(realFs.readLocalFile);
        fs.localPathIsFile.mockImplementation(realFs.localPathIsFile);
      });

      it('npm workspace compatible', async () => {
        GlobalConfig.set({
          localDir: getFixturePath('npm-compat-workspace/', './'),
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

      it('deno workspace', async () => {
        GlobalConfig.set({
          localDir: getFixturePath('workspace-01/', './'),
        });

        expect(
          await extractAllPackageFiles({}, [
            'deno.json',
            'deno.lock',
            'docs/deno.json',
            'packages/pkg1/deno.jsonc',
            'packages/pkg1/deno.lock',
          ]),
        ).toStrictEqual([
          {
            deps: [
              {
                currentRawValue: 'jsr:@luca/cases',
                currentValue: undefined,
                datasource: 'jsr',
                depName: '@luca/cases',
                depType: 'imports',
                lockedVersion: '1.0.0',
                versioning: 'deno',
              },
            ],
            lockFiles: ['packages/pkg1/deno.lock'],
            managerData: {
              workspaces: ['packages/*', 'docs'],
            },
            packageFile: 'deno.json',
          },
          {
            deps: [
              {
                currentRawValue: 'npm:dep2@2',
                currentValue: '2',
                datasource: 'npm',
                depName: 'dep2',
                depType: 'imports',
                lockedVersion: '2.0.0',
                versioning: 'deno',
              },
            ],
            lockFiles: ['packages/pkg1/deno.lock'],
            managerData: {
              packageName: 'docs',
            },
            packageFile: 'docs/deno.json',
            packageFileVersion: '1.0.2',
          },
          {
            deps: [
              {
                currentRawValue: 'jsr:@luca/flag@^1.0.0',
                currentValue: '^1.0.0',
                datasource: 'jsr',
                depName: '@luca/flag',
                depType: 'imports',
                lockedVersion: '1.0.1',
                versioning: 'deno',
              },
              {
                currentRawValue: 'npm:vite',
                currentValue: undefined,
                datasource: 'npm',
                depName: 'vite',
                depType: 'tasks',
                lockedVersion: '7.1.3',
                versioning: 'deno',
              },
              {
                currentRawValue: 'npm:vite',
                currentValue: undefined,
                datasource: 'npm',
                depName: 'vite',
                depType: 'tasks',
                lockedVersion: '7.1.3',
                versioning: 'deno',
              },
            ],
            lockFiles: ['packages/pkg1/deno.lock'],
            managerData: {
              packageName: 'pkg1',
            },
            packageFile: 'packages/pkg1/deno.jsonc',
            packageFileVersion: '0.1.0',
          },
        ]);
      });

      it('imports and scopes field is ignored when importMap is specified in the root config file', async () => {
        GlobalConfig.set({
          localDir: getFixturePath('workspace-02/', './'),
        });

        expect(
          await extractAllPackageFiles({}, [
            'deno.lock',
            'deno.json',
            'docs/deno.json',
          ]),
        ).toStrictEqual([
          {
            deps: [
              {
                currentRawValue: 'jsr:@scope/dep1@^2.1.3',
                currentValue: '^2.1.3',
                datasource: 'jsr',
                depName: '@scope/dep1',
                depType: 'imports',
                versioning: 'deno',
              },
              {
                currentRawValue:
                  'https://deno.land/std@0.222.0/front_matter/test.ts',
                currentValue: '0.222.0',
                datasource: 'deno',
                depName: 'https://deno.land/std',
                depType: 'imports',
                lockedVersion: '0.222.0',
              },
              {
                currentRawValue: 'https://deno.land/std/fs/copy.ts',
                currentValue: undefined,
                datasource: 'deno',
                depName: 'https://deno.land/std/fs/copy.ts',
                depType: 'imports',
                lockedVersion: '0.224.0',
              },
            ],
            lockFiles: ['deno.lock'],
            managerData: {
              workspaces: ['docs'],
            },
            packageFile: 'import_map.json',
          },
          {
            deps: [],
            lockFiles: ['deno.lock'],
            managerData: {
              packageName: 'docs',
            },
            packageFile: 'docs/deno.json',
            packageFileVersion: '1.0.2',
          },
        ]);
      });

      it('deno workspace with package.json', async () => {
        GlobalConfig.set({
          localDir: getFixturePath('workspace-03/', './'),
        });

        expect(
          await extractAllPackageFiles({}, [
            'deno.json',
            'deno.lock',
            'node/package.json',
          ]),
        ).toStrictEqual([
          {
            deps: [],
            lockFiles: ['deno.lock'],
            managerData: {
              workspaces: ['node'],
            },
            packageFile: 'deno.json',
          },
          {
            deps: [
              {
                currentValue: '^4.2.1',
                datasource: 'npm',
                depName: 'hono',
                depType: 'dependencies',
                lockedVersion: '4.9.5',
                prettyDepType: 'dependency',
              },
            ],
            extractedConstraints: {},
            lockFiles: ['deno.lock'],
            managerData: {
              packageName: undefined,
              workspaces: undefined,
            },
            packageFile: 'node/package.json',
            packageFileVersion: undefined,
          },
        ]);
      });
    });
  });
});
