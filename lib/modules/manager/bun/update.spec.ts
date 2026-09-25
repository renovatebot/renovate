import { codeBlock } from 'common-tags';
import { updateDependency } from './update.ts';

describe('modules/manager/bun/update', () => {
  describe('updateDependency()', () => {
    it('updates default catalog dependency at top level', () => {
      const fileContent = codeBlock`
        {
          "name": "my-monorepo",
          "catalog": {
            "react": "^18.0.0",
            "react-dom": "^18.0.0"
          }
        }
      `;

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBe(codeBlock`
        {
          "name": "my-monorepo",
          "catalog": {
            "react": "^19.0.0",
            "react-dom": "^18.0.0"
          }
        }
      `);
    });

    it('updates named catalog dependency at top level', () => {
      const fileContent = codeBlock`
        {
          "name": "my-monorepo",
          "catalogs": {
            "testing": {
              "jest": "29.0.0",
              "vitest": "1.0.0"
            }
          }
        }
      `;

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.testing',
          depName: 'jest',
          newValue: '30.0.0',
        },
      });

      expect(result).toBe(codeBlock`
        {
          "name": "my-monorepo",
          "catalogs": {
            "testing": {
              "jest": "30.0.0",
              "vitest": "1.0.0"
            }
          }
        }
      `);
    });

    it('updates default catalog nested under workspaces', () => {
      const fileContent = codeBlock`
        {
          "name": "my-monorepo",
          "workspaces": {
            "packages": ["packages/*"],
            "catalog": {
              "react": "^18.0.0"
            }
          }
        }
      `;

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBe(codeBlock`
        {
          "name": "my-monorepo",
          "workspaces": {
            "packages": ["packages/*"],
            "catalog": {
              "react": "^19.0.0"
            }
          }
        }
      `);
    });

    it('updates named catalog nested under workspaces', () => {
      const fileContent = codeBlock`
        {
          "name": "my-monorepo",
          "workspaces": {
            "packages": ["packages/*"],
            "catalogs": {
              "build": {
                "webpack": "5.0.0"
              }
            }
          }
        }
      `;

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.build',
          depName: 'webpack',
          newValue: '5.88.2',
        },
      });

      expect(result).toBe(codeBlock`
        {
          "name": "my-monorepo",
          "workspaces": {
            "packages": ["packages/*"],
            "catalogs": {
              "build": {
                "webpack": "5.88.2"
              }
            }
          }
        }
      `);
    });

    it('preserves formatting', () => {
      const fileContent = codeBlock`
        {
            "name": "my-monorepo",
            "catalog": { "react": "^18.0.0" }
        }
      `;

      const result = updateDependency({
        fileContent,
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBe(codeBlock`
        {
            "name": "my-monorepo",
            "catalog": { "react": "^19.0.0" }
        }
      `);
    });

    it('returns unchanged content when version is already up to date', () => {
      const fileContent = codeBlock`
        {
          "catalog": { "react": "^19.0.0" }
        }
      `;

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
      const result = updateDependency({
        fileContent: '{ "catalog": { "react": "^18.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'nonexistent',
          newValue: '1.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('returns null when named catalog does not exist', () => {
      const result = updateDependency({
        fileContent: '{ "catalogs": { "testing": { "jest": "29.0.0" } } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.nonexistent',
          depName: 'jest',
          newValue: '30.0.0',
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
      const result = updateDependency({
        fileContent: '{ "catalog": { "react": "^18.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('returns null when newValue is missing', () => {
      const result = updateDependency({
        fileContent: '{ "catalog": { "react": "^18.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
        },
      });

      expect(result).toBeNull();
    });

    it('delegates to npm updateDependency when depType is undefined', () => {
      const result = updateDependency({
        fileContent: '{ "dependencies": { "dep1": "1.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depName: 'dep1',
          newValue: '2.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('delegates non-catalog dependencies to npm updateDependency', () => {
      const result = updateDependency({
        fileContent: '{ "dependencies": { "dep1": "1.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'dependencies',
          depName: 'dep1',
          newValue: '2.0.0',
        },
      });

      expect(result).toBe('{ "dependencies": { "dep1": "2.0.0" } }');
    });

    it('does not treat depTypes that only resemble bun catalogs as catalogs', () => {
      const result = updateDependency({
        fileContent: '{ "catalog": { "dep1": "1.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bunXcatalog.default',
          depName: 'dep1',
          newValue: '2.0.0',
        },
      });

      expect(result).toBeNull();
    });

    it('updates a catalog named `default` under `catalogs`', () => {
      const result = updateDependency({
        fileContent: '{ "catalogs": { "default": { "react": "^18.0.0" } } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBe(
        '{ "catalogs": { "default": { "react": "^19.0.0" } } }',
      );
    });

    it('updates git version tag in catalog entry', () => {
      const result = updateDependency({
        fileContent: '{ "catalog": { "my-lib": "github:user/my-lib#v1.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'my-lib',
          currentRawValue: 'github:user/my-lib#v1.0.0',
          currentValue: 'v1.0.0',
          newValue: 'v2.0.0',
        },
      });

      expect(result).toBe(
        '{ "catalog": { "my-lib": "github:user/my-lib#v2.0.0" } }',
      );
    });

    it('updates git digest in catalog entry', () => {
      const result = updateDependency({
        fileContent:
          '{ "catalog": { "my-lib": "github:user/my-lib#abcd1234" } }',
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

      expect(result).toBe(
        '{ "catalog": { "my-lib": "github:user/my-lib#efgh5678" } }',
      );
    });

    it('updates npm alias in catalog entry', () => {
      const result = updateDependency({
        fileContent: '{ "catalog": { "my-react": "npm:react@^18.0.0" } }',
        packageFile: 'package.json',
        upgrade: {
          depType: 'bun.catalog.default',
          depName: 'my-react',
          npmPackageAlias: true,
          packageName: 'react',
          newValue: '^19.0.0',
        },
      });

      expect(result).toBe('{ "catalog": { "my-react": "npm:react@^19.0.0" } }');
    });
  });
});
