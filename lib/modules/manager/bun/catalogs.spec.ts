import { extractBunCatalogs } from './catalogs';

describe('modules/manager/bun/catalogs', () => {
  describe('extractBunCatalogs()', () => {
    it('returns null when no workspaces are present', () => {
      const result = extractBunCatalogs({}, 'package.json');
      expect(result).toBeNull();
    });

    it('returns null when workspaces have no catalogs', () => {
      const packageJson = {
        name: 'test',
        workspaces: {
          packages: ['packages/*'],
        },
      };
      const result = extractBunCatalogs(packageJson, 'package.json');
      expect(result).toBeNull();
    });

    it('extracts default catalog', () => {
      const packageJson = {
        name: 'test',
        workspaces: {
          packages: ['packages/*'],
          catalog: {
            react: '^18.0.0',
            'react-dom': '^18.0.0',
          },
        },
      };
      const result = extractBunCatalogs(packageJson, 'package.json');
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'react',
            currentValue: '^18.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.default',
            prettyDepType: 'bun.catalog.default',
          },
          {
            depName: 'react-dom',
            currentValue: '^18.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.default',
            prettyDepType: 'bun.catalog.default',
          },
        ],
        managerData: {
          packageJsonName: 'test',
        },
      });
    });

    it('extracts named catalogs', () => {
      const packageJson = {
        name: 'test',
        workspaces: {
          packages: ['packages/*'],
          catalogs: {
            testing: {
              jest: '29.0.0',
              'testing-library': '13.0.0',
            },
            build: {
              webpack: '5.88.2',
              babel: '7.22.10',
            },
          },
        },
      };
      const result = extractBunCatalogs(packageJson, 'package.json');
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'jest',
            currentValue: '29.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.testing',
            prettyDepType: 'bun.catalog.testing',
          },
          {
            depName: 'testing-library',
            currentValue: '13.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.testing',
            prettyDepType: 'bun.catalog.testing',
          },
          {
            depName: 'webpack',
            currentValue: '5.88.2',
            datasource: 'npm',
            depType: 'bun.catalog.build',
            prettyDepType: 'bun.catalog.build',
          },
          {
            depName: 'babel',
            currentValue: '7.22.10',
            datasource: 'npm',
            depType: 'bun.catalog.build',
            prettyDepType: 'bun.catalog.build',
          },
        ],
        managerData: {
          packageJsonName: 'test',
        },
      });
    });

    it('extracts both default and named catalogs', () => {
      const packageJson = {
        name: 'test',
        workspaces: {
          packages: ['packages/*'],
          catalog: {
            react: '^18.0.0',
          },
          catalogs: {
            testing: {
              jest: '29.0.0',
            },
          },
        },
      };
      const result = extractBunCatalogs(packageJson, 'package.json');
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'react',
            currentValue: '^18.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.default',
            prettyDepType: 'bun.catalog.default',
          },
          {
            depName: 'jest',
            currentValue: '29.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.testing',
            prettyDepType: 'bun.catalog.testing',
          },
        ],
        managerData: {
          packageJsonName: 'test',
        },
      });
    });

    it('handles empty catalogs gracefully', () => {
      const packageJson = {
        name: 'test',
        workspaces: {
          packages: ['packages/*'],
          catalog: {},
          catalogs: {
            empty: {},
          },
        },
      };
      const result = extractBunCatalogs(packageJson, 'package.json');
      expect(result).toMatchObject({
        deps: [],
        managerData: {
          packageJsonName: 'test',
        },
      });
    });

    it('handles invalid catalog entries gracefully', () => {
      const packageJson = {
        name: 'test',
        workspaces: {
          packages: ['packages/*'],
          catalog: {
            react: '^18.0.0',
          },
          catalogs: {
            invalid: 'not-an-object',
            valid: {
              jest: '29.0.0',
            },
          },
        },
      };
      const result = extractBunCatalogs(packageJson, 'package.json');
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'react',
            currentValue: '^18.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.default',
            prettyDepType: 'bun.catalog.default',
          },
          {
            depName: 'jest',
            currentValue: '29.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.valid',
            prettyDepType: 'bun.catalog.valid',
          },
        ],
        managerData: {
          packageJsonName: 'test',
        },
      });
    });

    it('extracts catalogs from root level when workspaces is an array', () => {
      const packageJson = {
        name: 'test',
        workspaces: ['packages/*'],
        catalog: {
          react: '^18.0.0',
        },
        catalogs: {
          testing: {
            jest: '29.0.0',
          },
        },
      };
      const result = extractBunCatalogs(packageJson, 'package.json');
      expect(result).toMatchObject({
        deps: [
          {
            depName: 'react',
            currentValue: '^18.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.default',
            prettyDepType: 'bun.catalog.default',
          },
          {
            depName: 'jest',
            currentValue: '29.0.0',
            datasource: 'npm',
            depType: 'bun.catalog.testing',
            prettyDepType: 'bun.catalog.testing',
          },
        ],
        managerData: {
          packageJsonName: 'test',
        },
      });
    });
  });
});
