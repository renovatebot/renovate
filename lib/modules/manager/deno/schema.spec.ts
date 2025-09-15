import {
  CompilerOptions,
  DenoDependency,
  Imports,
  Lint,
  Scopes,
  Tasks,
  Workspace,
} from './schema';

describe('modules/manager/deno/schema', () => {
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
          task2: {
            command: 'deno run npm:dep1',
          },
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
        {
          currentRawValue: 'npm:dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: 'dep1',
          depType: 'tasks',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('CompilerOptions', () => {
    it('parses default values', () => {
      expect(CompilerOptions.parse({})).toEqual([]);
    });

    it('parses compilerOptions.types', () => {
      expect(
        CompilerOptions.parse({
          types: ['npm:@types/dep1'],
        }),
      ).toEqual([
        {
          currentRawValue: 'npm:@types/dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: '@types/dep1',
          depType: 'compilerOptions',
          versioning: 'deno',
        },
      ]);
    });

    it('parses compilerOptions.jsxImportSource', () => {
      expect(
        CompilerOptions.parse({
          jsxImportSource: 'npm:dep1',
        }),
      ).toEqual([
        {
          currentRawValue: 'npm:dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: 'dep1',
          depType: 'compilerOptions',
          versioning: 'deno',
        },
      ]);
    });

    it('parses compilerOptions.jsxImportSourceTypes', () => {
      expect(
        CompilerOptions.parse({
          jsxImportSourceTypes: 'npm:@types/dep1',
        }),
      ).toEqual([
        {
          currentRawValue: 'npm:@types/dep1',
          currentValue: undefined,
          datasource: 'npm',
          depName: '@types/dep1',
          depType: 'compilerOptions',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('Lint', () => {
    it('parses default values', () => {
      expect(Lint.parse({})).toEqual([]);
    });

    it('parses lint.rules', () => {
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
          depType: 'lint',
          versioning: 'deno',
        },
      ]);
    });
  });

  describe('Workspace', () => {
    it('parses workspace array', () => {
      expect(Workspace.parse(['packages/*', 'libs/*'])).toEqual({
        workspaces: ['packages/*', 'libs/*'],
      });
    });

    it('parses workspace object', () => {
      expect(
        Workspace.parse({
          members: ['packages/*', 'libs/*'],
        }),
      ).toEqual({
        workspaces: ['packages/*', 'libs/*'],
      });
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
});
