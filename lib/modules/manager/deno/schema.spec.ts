import {
  CompilerOptionsJsxImportSource,
  CompilerOptionsJsxImportSourceTypes,
  CompilerOptionsTypes,
  DenoDependency,
  DenoExtract,
  DenoLock,
  ImportMapExtract,
  Imports,
  Lint,
  Lock,
  Scopes,
  Tasks,
  UpdateDenoJsonFile,
  UpdateImportMapJsonFile,
  Workspace,
} from './schema.ts';

describe('modules/manager/deno/schema', () => {
  describe('DenoLock', () => {
    it('parses lock file with specifiers', () => {
      expect(
        DenoLock.parse(
          JSON.stringify({
            version: '5',
            specifiers: {
              'jsr:@scope/package': '1.0.0_other@2.0.0',
            },
            redirects: {},
            remote: {},
          }),
        ),
      ).toEqual({
        lockedVersions: {
          'jsr:@scope/package': '1.0.0',
        },
        redirectVersions: {},
        remoteVersions: new Set(),
        lockfileVersion: 5,
      });
    });

    it('parses lock file with specifiers that do not match regex', () => {
      expect(
        DenoLock.parse(
          JSON.stringify({
            version: '5',
            specifiers: {
              valid_key: '_startswith_underscore',
            },
            redirects: {},
            remote: {},
          }),
        ),
      ).toEqual({
        lockedVersions: {},
        redirectVersions: {},
        remoteVersions: new Set(),
        lockfileVersion: 5,
      });
    });

    it('parses lock file with redirects', () => {
      expect(
        DenoLock.parse(
          JSON.stringify({
            version: '5',
            specifiers: {},
            redirects: {
              'https://example.com/old': 'https://example.com/new',
            },
            remote: {},
          }),
        ),
      ).toEqual({
        lockedVersions: {},
        redirectVersions: {
          'https://example.com/old': 'https://example.com/new',
        },
        remoteVersions: new Set(),
        lockfileVersion: 5,
      });
    });

    it('parses lock file with remote entries', () => {
      expect(
        DenoLock.parse(
          JSON.stringify({
            version: '5',
            specifiers: {},
            redirects: {},
            remote: {
              'https://example.com/module.ts': 'sha256-hash',
            },
          }),
        ),
      ).toEqual({
        lockedVersions: {},
        redirectVersions: {},
        remoteVersions: new Set(['https://example.com/module.ts']),
        lockfileVersion: 5,
      });
    });
  });

  describe('Lock', () => {
    it('parses lock as string', () => {
      expect(Lock.parse('deno.lock')).toEqual('deno.lock');
    });

    it('parses lock as object', () => {
      expect(Lock.parse({ path: 'genuine-deno.lock' })).toEqual(
        'genuine-deno.lock',
      );
    });

    it('parses lock as boolean true', () => {
      expect(Lock.parse(true)).toEqual('deno.lock');
    });

    it('parses lock as boolean false', () => {
      expect(Lock.parse(false)).toEqual(false);
    });
  });

  describe('Imports', () => {
    it('parses default values', () => {
      expect(Imports.parse({})).toEqual([]);
    });

    it('parses imports', () => {
      expect(
        Imports.parse({
          dep1: 'jsr:@scope/package-name@^1.0.0',
        }),
      ).toEqual([
        {
          currentRawValue: 'jsr:@scope/package-name@^1.0.0',
          currentValue: '^1.0.0',
          datasource: 'jsr',
          depName: '@scope/package-name',
          depType: 'imports',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('scopes', () => {
    it('parses default values', () => {
      expect(Scopes.parse({})).toEqual([]);
    });

    it('parses scopes', () => {
      expect(
        Scopes.parse({
          '/scope': {
            dep1: 'jsr:@scope/package-name@^1.0.0',
          },
        }),
      ).toEqual([
        {
          currentRawValue: 'jsr:@scope/package-name@^1.0.0',
          currentValue: '^1.0.0',
          datasource: 'jsr',
          depName: '@scope/package-name',
          depType: 'scopes',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('Tasks', () => {
    it('parses default values', () => {
      expect(Tasks.parse({})).toEqual([]);
    });

    it('parses tasks', () => {
      expect(
        Tasks.parse({
          task1: 'deno run jsr:@scope/package-name@^1.0.0',
        }),
      ).toEqual([
        {
          currentRawValue: 'jsr:@scope/package-name@^1.0.0',
          currentValue: '^1.0.0',
          datasource: 'jsr',
          depName: '@scope/package-name',
          depType: 'tasks',
          versioning: 'deno',
        },
      ]);
    });

    it('parses tasks.command', () => {
      expect(
        Tasks.parse({
          task1: {
            command: 'deno run npm:dep1',
          },
        }),
      ).toEqual([
        {
          currentRawValue: 'npm:dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: 'dep1',
          depType: 'tasks.command',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('CompilerOptionsTypes', () => {
    it('parses compilerOptions.types', () => {
      expect(CompilerOptionsTypes.parse(['npm:@types/dep1'])).toEqual([
        {
          currentRawValue: 'npm:@types/dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: '@types/dep1',
          depType: 'compilerOptions.types',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('CompilerOptionsJsxImportSource', () => {
    it('parses compilerOptions.jsxImportSource', () => {
      expect(CompilerOptionsJsxImportSource.parse('npm:dep1')).toEqual([
        {
          currentRawValue: 'npm:dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: 'dep1',
          depType: 'compilerOptions.jsxImportSource',
          versioning: 'deno',
        },
      ]);
    });

    it('parses undefined compilerOptions.jsxImportSource', () => {
      expect(CompilerOptionsJsxImportSource.parse(undefined)).toEqual([]);
    });
  });

  describe('CompilerOptionsJsxImportSourceTypes', () => {
    it('parses compilerOptions.jsxImportSourceTypes', () => {
      expect(
        CompilerOptionsJsxImportSourceTypes.parse('npm:@types/dep1'),
      ).toEqual([
        {
          currentRawValue: 'npm:@types/dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: '@types/dep1',
          depType: 'compilerOptions.jsxImportSourceTypes',
          versioning: 'deno',
        },
      ]);
    });

    it('parses undefined compilerOptions.jsxImportSourceTypes', () => {
      expect(CompilerOptionsJsxImportSourceTypes.parse(undefined)).toEqual([]);
    });
  });

  describe('Lint', () => {
    it('parses default values', () => {
      expect(Lint.parse({})).toEqual([]);
    });

    it('parses lint.plugins', () => {
      expect(
        Lint.parse({
          plugins: ['npm:dep1'],
        }),
      ).toEqual([
        {
          currentRawValue: 'npm:dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: 'dep1',
          depType: 'lint.plugins',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('Workspace', () => {
    it('parses workspace array', () => {
      expect(Workspace.parse(['packages/*', 'libs/*'])).toEqual([
        'packages/*',
        'libs/*',
      ]);
    });

    it('parses workspace object', () => {
      expect(
        Workspace.parse({
          members: ['packages/*', 'libs/*'],
        }),
      ).toEqual(['packages/*', 'libs/*']);
    });
  });

  describe('DenoDependency', () => {
    it('invalid npm package names', () => {
      expect(
        DenoDependency.parse({
          depValue: 'npm:_test@1.0.0',
          depType: 'imports',
        }),
      ).toEqual({
        datasource: 'npm',
        skipReason: 'invalid-name',
        versioning: 'deno',
      });
    });

    it('invalid npm package versions', () => {
      expect(
        DenoDependency.parse({
          depValue: 'npm:dep1@INVALID',
          depType: 'imports',
        }),
      ).toEqual({
        datasource: 'npm',
        versioning: 'deno',
        skipReason: 'invalid-version',
      });
    });

    it('invalid jsr package names', () => {
      expect(
        DenoDependency.parse({
          depValue: 'jsr:@scope//name@1.0.0',
          depType: 'imports',
        }),
      ).toEqual({
        datasource: 'jsr',
        skipReason: 'invalid-name',
        versioning: 'deno',
      });
    });

    it('invalid jsr package versions', () => {
      expect(
        DenoDependency.parse({
          depValue: 'jsr:@scope/name@INVALID',
          depType: 'imports',
        }),
      ).toEqual({
        datasource: 'jsr',
        versioning: 'deno',
        skipReason: 'invalid-version',
      });
    });

    it('unsupported datasource', () => {
      expect(
        DenoDependency.parse({
          depValue: 'unsupported:package@1.0.0',
          depType: 'imports',
        }),
      ).toEqual({
        depType: 'imports',
        depName: 'unsupported:package@1.0.0',
        skipStage: 'extract',
        skipReason: 'unsupported',
      });
    });

    it('deno.land URL without package name', () => {
      expect(
        DenoDependency.parse({
          depValue: 'https://deno.land/',
          depType: 'imports',
        }),
      ).toEqual({
        depType: 'imports',
        depName: 'https://deno.land/',
        skipStage: 'extract',
        skipReason: 'unsupported',
      });
    });

    it('deno.land URL with version', () => {
      expect(
        DenoDependency.parse({
          depValue: 'https://deno.land/x/package@1.0.0',
          depType: 'imports',
        }),
      ).toEqual({
        datasource: 'deno',
        depType: 'imports',
        depName: 'https://deno.land/x/package',
        currentValue: '1.0.0',
        currentRawValue: 'https://deno.land/x/package@1.0.0',
      });
    });
  });

  describe('DenoLock via DenoDependency transform path', () => {
    it('handles empty specifiers in lock file', () => {
      expect(
        DenoLock.parse(
          JSON.stringify({
            version: '5',
            specifiers: {},
            redirects: {},
            remote: {},
          }),
        ),
      ).toEqual({
        lockedVersions: {},
        redirectVersions: {},
        remoteVersions: new Set(),
        lockfileVersion: 5,
      });
    });
  });

  describe('UpdateDenoJsonFile', () => {
    it('keep original field that is irrelevant for schema', () => {
      expect(
        UpdateDenoJsonFile.parse(
          JSON.stringify({
            name: 'package',
            version: '1.0.0',
            unknownFiled: 'should keep',
          }),
        ),
      ).toEqual({
        name: 'package',
        version: '1.0.0',
        unknownFiled: 'should keep',
      });
    });
  });

  describe('ImportMapExtract', () => {
    it('parses import map with imports and scopes', () => {
      expect(
        ImportMapExtract.parse(
          JSON.stringify({
            imports: {
              dep1: 'npm:package@1.0.0',
            },
            scopes: {
              '/scope': {
                dep2: 'jsr:@scope/package@2.0.0',
              },
            },
          }),
        ),
      ).toEqual({
        dependencies: [
          {
            currentRawValue: 'npm:package@1.0.0',
            currentValue: '1.0.0',
            datasource: 'npm',
            depName: 'package',
            depType: 'imports',
            versioning: 'deno',
          },
          {
            currentRawValue: 'jsr:@scope/package@2.0.0',
            currentValue: '2.0.0',
            datasource: 'jsr',
            depName: '@scope/package',
            depType: 'scopes',
            versioning: 'deno',
          },
        ],
      });
    });

    it('parses import map with only imports', () => {
      expect(
        ImportMapExtract.parse(
          JSON.stringify({
            imports: {
              dep1: 'npm:package@1.0.0',
            },
          }),
        ),
      ).toEqual({
        dependencies: [
          {
            currentRawValue: 'npm:package@1.0.0',
            currentValue: '1.0.0',
            datasource: 'npm',
            depName: 'package',
            depType: 'imports',
            versioning: 'deno',
          },
        ],
      });
    });

    it('parses empty import map', () => {
      expect(ImportMapExtract.parse(JSON.stringify({}))).toEqual({
        dependencies: [],
      });
    });
  });

  describe('DenoExtract', () => {
    it('parses deno.json with all sections', () => {
      const result = DenoExtract.parse({
        content: JSON.stringify({
          imports: {
            dep1: 'npm:package@1.0.0',
          },
          scopes: {
            '/scope': {
              dep2: 'jsr:@scope/package@2.0.0',
            },
          },
          tasks: {
            task1: 'deno run npm:dep3',
          },
          compilerOptions: {
            types: ['npm:@types/dep4'],
            jsxImportSource: 'npm:react',
            jsxImportSourceTypes: 'npm:@types/react',
          },
          lint: {
            plugins: ['npm:eslint-plugin'],
          },
        }),
        fileName: 'deno.json',
      });

      expect(result.fileName).toBe('deno.json');
      expect(result.content).toHaveProperty('lock');
      expect(result.content).toHaveProperty('importMap');
      expect(result.content).toHaveProperty('managerData');
      expect(result.content).toHaveProperty('dependencies');
      expect(result.content.dependencies.length).toBeGreaterThan(0);
    });

    it('parses minimal deno.json', () => {
      const result = DenoExtract.parse({
        content: JSON.stringify({}),
        fileName: 'deno.json',
      });

      expect(result.fileName).toBe('deno.json');
      expect(result.content.dependencies).toEqual([]);
    });

    it('parses deno.json with workspace', () => {
      const result = DenoExtract.parse({
        content: JSON.stringify({
          workspace: ['packages/*', 'libs/*'],
        }),
        fileName: 'deno.json',
      });

      expect(result.content.managerData.workspaces).toEqual([
        'packages/*',
        'libs/*',
      ]);
    });

    it('parses deno.json with lock config', () => {
      const result = DenoExtract.parse({
        content: JSON.stringify({
          lock: 'genuine-deno.lock',
        }),
        fileName: 'deno.json',
      });

      expect(result.content.lock).toBe('genuine-deno.lock');
    });

    it('parses deno.json with importMap', () => {
      const result = DenoExtract.parse({
        content: JSON.stringify({
          importMap: './import_map.json',
        }),
        fileName: 'deno.json',
      });

      expect(result.content.importMap).toBe('./import_map.json');
    });
  });

  describe('UpdateImportMapJsonFile', () => {
    it('keep original field that is irrelevant for schema', () => {
      expect(
        UpdateImportMapJsonFile.parse(
          JSON.stringify({
            integrity: {
              './modules/shapes/square.js':
                'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
            },
            unknownFiled: 'should keep',
          }),
        ),
      ).toEqual({
        integrity: {
          './modules/shapes/square.js':
            'sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC',
        },
        unknownFiled: 'should keep',
      });
    });
  });
});
