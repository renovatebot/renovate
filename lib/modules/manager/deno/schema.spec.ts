import {
  CompilerOptionsJsxImportSource,
  CompilerOptionsJsxImportSourceTypes,
  CompilerOptionsTypes,
  DenoDependency,
  Imports,
  Lint,
  Lock,
  Scopes,
  Tasks,
  UpdateDenoJsonFile,
  UpdateImportMapJsonFile,
  Workspace,
} from './schema';

describe('modules/manager/deno/schema', () => {
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
