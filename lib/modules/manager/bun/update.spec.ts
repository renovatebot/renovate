import { updateDependency } from './update.ts';

vi.mock('jsonc-weaver', async (importOriginal) => {
  const original = await importOriginal<typeof import('jsonc-weaver')>();
  return {
    ...original,
    weave: vi.fn(original.weave),
  };
});

describe('modules/manager/bun/update', () => {
  describe('updateDependency()', () => {
    it('updates default catalog dependency at top level', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalog: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.catalog.react).toBe('^19.0.0');
      // Other deps should remain unchanged
      expect(parsed.catalog['react-dom']).toBe('^18.0.0');
    });

    it('updates named catalog dependency at top level', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalogs: {
            testing: {
              jest: '29.0.0',
              vitest: '1.0.0',
            },
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.testing',
          depName: 'jest',
          newValue: '30.0.0',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.catalogs.testing.jest).toBe('30.0.0');
      expect(parsed.catalogs.testing.vitest).toBe('1.0.0');
    });

    it('updates default catalog nested under workspaces', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          workspaces: {
            packages: ['packages/*'],
            catalog: {
              react: '^18.0.0',
            },
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.workspaces.catalog.react).toBe('^19.0.0');
    });

    it('updates named catalog nested under workspaces', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          workspaces: {
            packages: ['packages/*'],
            catalogs: {
              build: {
                webpack: '5.0.0',
              },
            },
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.build',
          depName: 'webpack',
          newValue: '5.88.2',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.workspaces.catalogs.build.webpack).toBe('5.88.2');
    });

    it('preserves formatting when updating', () => {
      // Use specific indentation to verify formatting preservation
      const fileContent = [
        '{',
        '    "name": "my-monorepo",',
        '    "catalog": {',
        '        "react": "^18.0.0"',
        '    }',
        '}',
      ].join('\n');

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).not.toBeNull();
      // Should preserve the 4-space indentation
      expect(result).toContain('    "catalog"');
      expect(result).toContain('        "react": "^19.0.0"');
      const parsed = JSON.parse(result!);
      expect(parsed.catalog.react).toBe('^19.0.0');
    });

    it('returns unchanged content when version is already up to date', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalog: { react: '^19.0.0' },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBe(fileContent);
    });

    it('returns null when dependency is not found in catalog', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalog: { react: '^18.0.0' },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'nonexistent',
          newValue: '1.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      const result = updateDependency({
        fileContent: 'not valid json',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('returns null when depName is missing', () => {
      const fileContent = JSON.stringify(
        { catalog: { react: '^18.0.0' } },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('returns null when newValue is missing', () => {
      const fileContent = JSON.stringify(
        { catalog: { react: '^18.0.0' } },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
        },
      });

      expect(result).toBeNull();
    });

    it('delegates non-catalog dependencies to npm updateDependency', () => {
      const fileContent = JSON.stringify(
        {
          name: 'test',
          dependencies: { dep1: '1.0.0' },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'dependencies',
          depName: 'dep1',
          newValue: '2.0.0',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.dependencies.dep1).toBe('2.0.0');
    });

    it('returns null when jsonc-weaver fails', async () => {
      const { weave } = await import('jsonc-weaver');
      vi.mocked(weave).mockImplementationOnce(() => {
        throw new Error('weave failure');
      });

      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalog: {
            react: '^18.0.0',
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('updates git version tag in catalog entry', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalog: {
            'my-lib': 'github:user/my-lib#v1.0.0',
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'my-lib',
          currentRawValue: 'github:user/my-lib#v1.0.0',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.catalog['my-lib']).toBe('github:user/my-lib#v2.0.0');
    });

    it('updates git digest in catalog entry', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalog: {
            'my-lib': 'github:user/my-lib#abcd1234',
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'my-lib',
          currentRawValue: 'github:user/my-lib#abcd1234',
          currentDigest: 'abcd1234',
          newDigest: 'efgh5678',
          newValue: 'v2.0.0',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.catalog['my-lib']).toBe('github:user/my-lib#efgh5678');
    });

    it('updates npm alias in catalog entry', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalog: {
            'my-react': 'npm:react@^18.0.0',
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'my-react',
          npmPackageAlias: true,
          packageName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.catalog['my-react']).toBe('npm:react@^19.0.0');
    });

    it('returns null for named catalog that does not exist', () => {
      const fileContent = JSON.stringify(
        {
          name: 'my-monorepo',
          catalogs: {
            testing: { jest: '29.0.0' },
          },
        },
        null,
        2,
      );

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.nonexistent',
          depName: 'jest',
          newValue: '30.0.0',
        },
      });

      expect(result).toBeNull();
    });
  });
});
