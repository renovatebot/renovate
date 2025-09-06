import type { UpdateDependencyConfig } from '../types';
import { updateDependency } from './update';
import { Fixtures } from '~test/fixtures';

describe('modules/manager/deno/update', () => {
  describe('updateDependency', () => {
    describe('deno.json/jsonc', () => {
      it('updates dependency in imports', () => {
        const fileContent = JSON.stringify(
          {
            imports: {
              fs: 'https://deno.land/std@0.223.0/fs/mod.ts',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'https://deno.land/std',
          depType: 'imports',
          currentValue: '0.223.0',
          newValue: '0.224.0',
          datasource: 'deno',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result!);
        expect(parsed.imports.fs).toBe(
          'https://deno.land/std@0.224.0/fs/mod.ts',
        );
      });

      it('updates dependency in scopes', () => {
        const fileContent = JSON.stringify(
          {
            scopes: {
              'https://deno.land/x/': {
                dep2: 'jsr:@scope/dep1@latest',
              },
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: '@scope/dep1',
          depType: 'scopes',
          currentValue: 'latest',
          newValue: '2.0.0',
          datasource: 'jsr',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });

        expect(result).not.toBeNull();
        const parsed = JSON.parse(result!);
        expect(parsed.scopes['https://deno.land/x/'].dep2).toBe(
          'jsr:@scope/dep1@2.0.0',
        );
      });

      it('updates dependency in tasks', () => {
        const fileContent = JSON.stringify(
          {
            tasks: {
              build: 'deno run -A npm:dep1@4.0.0',
              dev: {
                command: 'deno run --allow-net npm:dep2@14.0.1',
              },
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'tasks',
          currentValue: '4.0.0',
          newValue: '4.1.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const resul1 = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(resul1!);
        expect(parsed.tasks.build).toBe('deno run -A npm:dep1@4.1.0');

        {
          const upgrade: UpdateDependencyConfig['upgrade'] = {
            depName: 'dep2',
            depType: 'tasks',
            currentValue: '14.0.1',
            newValue: '16.0.0',
            datasource: 'npm',
            packageFile: 'deno.json',
          };

          const result = updateDependency({
            fileContent: resul1!,
            upgrade,
          });
          const parsed = JSON.parse(result!);
          expect(parsed.tasks.dev.command).toBe(
            'deno run --allow-net npm:dep2@16.0.0',
          );
        }
      });

      it('updates dependency in compilerOptions', () => {
        const fileContent = JSON.stringify(
          {
            compilerOptions: {
              types: ['npm:@types/dep2@18.0.0'],
              jsxImportSource: 'https://deno.land/x/dep2@18.0.0',
              jsxImportSourceTypes: 'npm:@types/dep2@18.0.0',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'https://deno.land/x/dep2',
          depType: 'compilerOptions',
          currentValue: '18.0.0',
          newValue: '19.0.0',
          datasource: 'deno',
          packageFile: 'deno.json',
        };

        const result1 = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result1!);
        expect(parsed.compilerOptions.jsxImportSource).toBe(
          'https://deno.land/x/dep2@19.0.0',
        );

        {
          const upgrade: UpdateDependencyConfig['upgrade'] = {
            depName: '@types/dep2',
            depType: 'compilerOptions',
            currentValue: '18.0.0',
            newValue: '19.0.0',
            datasource: 'npm',
            packageFile: 'deno.json',
          };

          const result = updateDependency({
            fileContent: result1!,
            upgrade,
          });
          const parsed = JSON.parse(result!);
          expect(parsed.compilerOptions.types[0]).toContain(
            'npm:@types/dep2@19.0.0',
          );
          expect(parsed.compilerOptions.jsxImportSourceTypes).toBe(
            'npm:@types/dep2@19.0.0',
          );
        }
      });

      it('updates dependency in compilerOptions.jsxImportSourceTypes', () => {
        const fileContent = JSON.stringify(
          {
            compilerOptions: {
              jsxImportSourceTypes: 'npm:@types/dep2@18.0.0',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: '@types/dep2',
          depType: 'compilerOptions',
          currentValue: '18.0.0',
          newValue: '19.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({
          fileContent,
          upgrade,
        });
        const parsed = JSON.parse(result!);
        expect(parsed.compilerOptions.jsxImportSourceTypes).toBe(
          'npm:@types/dep2@19.0.0',
        );
      });

      it('updates dependency in lint plugins', () => {
        const fileContent = JSON.stringify(
          {
            lint: {
              plugins: ['npm:dep1@5.0.0'],
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'lint',
          currentValue: '5.0.0',
          newValue: '6.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result!);
        expect(parsed.lint.plugins).toContain('npm:dep1@6.0.0');
      });

      it('handles dependency without version', () => {
        const fileContent = JSON.stringify(
          {
            imports: {
              dep1: 'npm:dep1',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: undefined,
          newValue: '1.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result!);
        expect(parsed.imports.dep1).toBe('npm:dep1@1.0.0');
      });

      it('returns null if packageFile is not defined', () => {
        const fileContent = JSON.stringify({}, null, 2);
        const upgrade: UpdateDependencyConfig['upgrade'] = {};

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('returns null for not supported datasource', () => {
        const fileContent = JSON.stringify(
          {
            imports: {
              dep1: 'unknown:dep1@1.0.0',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'unknown',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('currentValue is not defined when deno datasource', () => {
        const fileContent = JSON.stringify(
          {
            imports: {
              fs: 'https://deno.land/std/fs',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'https://deno.land/std/fs',
          depType: 'imports',
          newValue: '2.0.0',
          datasource: 'deno',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result!);
        expect(parsed.imports.fs).toBe('https://deno.land/std/fs@2.0.0');
      });

      it('returns null for missing required values', () => {
        const fileContent = '{}';

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: undefined,
          depType: undefined,
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('handles complex JSON with nested structures', () => {
        const fileContent = JSON.stringify(
          {
            name: 'my-deno-app',
            version: '1.0.0',
            imports: {
              dep1: 'npm:dep1@1.0.0',
              dep2: 'npm:dep2@1.0.0',
            },
            tasks: {
              build: 'deno run -A npm:dep1@2.0.0 build',
              dev: {
                command: 'deno run -A --watch npm:dep1@3.0.0 dev',
              },
            },
            compilerOptions: {
              jsx: 'dep1',
              jsxImportSource: 'npm:dep1@1.0.0',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '1.1.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result1 = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result1!);
        expect(parsed.imports.dep1).toBe('npm:dep1@1.1.0');
      });

      it('handles the case where the desired version is already supported', () => {
        const fileContent = JSON.stringify({
          imports: {
            dep1: 'npm:dep1@1.0.0',
          },
        });

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '1.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toEqual(fileContent);
      });

      it('returns null if empty file', () => {
        const fileContent = '{}';

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: undefined,
          depType: undefined,
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('handles error during update gracefully', () => {
        const fileContent = 'invalid json';

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('depName is not defined', () => {
        const fileContent = JSON.stringify({
          imports: {
            dep1: 'invalid:dep1@1.0.0',
          },
        });

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: undefined,
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'invalid',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('unsupported packageFile', () => {
        const fileContent = JSON.stringify({});

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'npm',
          packageFile: 'unknown.yaml',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('replaces only exact matches', () => {
        const fileContent = JSON.stringify({
          imports: {
            dep1: 'npm:dep1@1.0.0',
            dep11: 'npm:dep11@1.0.0',
          },
        });

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'npm',
          packageFile: 'deno.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result!);
        expect(parsed.imports.dep1).toContain('npm:dep1@2.0.0');
      });
    });

    describe('<importMap>.json', () => {
      it('updates dependency in imports', () => {
        const fileContent = JSON.stringify({
          imports: {
            dep1: 'jsr:@scope/dep1@1.0.0',
          },
        });

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: '@scope/dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'jsr',
          packageFile: 'import_map.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        const parsed = JSON.parse(result!);
        expect(parsed.imports.dep1).toContain('jsr:@scope/dep1@2.0.0');
      });

      it('handles error during update gracefully', () => {
        const fileContent = 'invalid json';

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'npm',
          packageFile: 'import_map.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('returns null for not supported datasource', () => {
        const fileContent = JSON.stringify(
          {
            imports: {
              dep1: 'unknown:dep1@1.0.0',
            },
          },
          null,
          2,
        );

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: 'dep1',
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'unknown',
          packageFile: 'import_map.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });

      it('depName is not defined', () => {
        const fileContent = JSON.stringify({
          imports: {
            dep1: 'invalid:dep1@1.0.0',
          },
        });

        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depName: undefined,
          depType: 'imports',
          currentValue: '1.0.0',
          newValue: '2.0.0',
          datasource: 'invalid',
          packageFile: 'import_map.json',
        };

        const result = updateDependency({ fileContent, upgrade });
        expect(result).toBeNull();
      });
    });

    describe('package.json', () => {
      // ported from lib/modules/manager/npm/update/dependency/index.spec.ts
      it('replaces a dependency value', () => {
        const readFixture = (x: string): string => Fixtures.get(x, '../npm');

        const input01Content = readFixture('inputs/01.json');
        const upgrade: UpdateDependencyConfig['upgrade'] = {
          depType: 'dependencies',
          depName: 'cheerio',
          newValue: '0.22.1',
          packageFile: 'package.json',
        };
        const outputContent = readFixture('outputs/011.json');
        const testContent = updateDependency({
          fileContent: input01Content,
          upgrade,
        });
        expect(testContent).toEqual(outputContent);
      });
    });
  });
});
