import type { Catalog } from '../types.ts';
import { extractCatalogDeps } from './catalogs.ts';

describe('modules/manager/npm/extract/common/catalogs', () => {
  it('returns correct dependencies for pnpm', () => {
    const sampleCatalog: Catalog[] = [
      {
        name: 'default',
        dependencies: {
          react: '17.0.2',
        },
      },
      {
        name: 'custom',
        dependencies: {
          lodash: '4.17.21',
        },
      },
    ];
    const result = extractCatalogDeps(sampleCatalog, 'pnpm');
    expect(result).toEqual([
      {
        depType: 'pnpm.catalog.default',
        depName: 'react',
        currentValue: '17.0.2',
        datasource: 'npm',
        prettyDepType: 'pnpm.catalog.default',
      },
      {
        depType: 'pnpm.catalog.custom',
        depName: 'lodash',
        currentValue: '4.17.21',
        datasource: 'npm',
        prettyDepType: 'pnpm.catalog.custom',
      },
    ]);
  });

  it('returns correct dependencies for yarn', () => {
    const sampleCatalog: Catalog[] = [
      {
        name: 'default',
        dependencies: {
          react: '17.0.2',
        },
      },
      {
        name: 'custom',
        dependencies: {
          lodash: '4.17.21',
        },
      },
    ];
    const result = extractCatalogDeps(sampleCatalog, 'yarn');
    expect(result).toEqual([
      {
        depType: 'yarn.catalog.default',
        depName: 'react',
        currentValue: '17.0.2',
        datasource: 'npm',
        prettyDepType: 'yarn.catalog.default',
      },
      {
        depType: 'yarn.catalog.custom',
        depName: 'lodash',
        currentValue: '4.17.21',
        datasource: 'npm',
        prettyDepType: 'yarn.catalog.custom',
      },
    ]);
  });

  it('handles empty catalogs list', () => {
    const result = extractCatalogDeps([], 'pnpm');
    const resultYarn = extractCatalogDeps([], 'yarn');
    expect(result).toEqual([]);
    expect(resultYarn).toEqual([]);
  });

  it('handles catalog with no dependencies', () => {
    const result = extractCatalogDeps(
      [{ name: 'pnpm.catalog.empty', dependencies: {} }],
      'pnpm',
    );
    const resultYarn = extractCatalogDeps(
      [{ name: 'yarn.catalog.empty', dependencies: {} }],
      'yarn',
    );
    expect(result).toEqual([]);
    expect(resultYarn).toEqual([]);
  });

  it('returns correct dependencies for bun', () => {
    const sampleCatalog: Catalog[] = [
      {
        name: 'default',
        dependencies: {
          react: '^19.0.0',
        },
      },
      {
        name: 'testing',
        dependencies: {
          jest: '30.0.0',
        },
      },
    ];
    const result = extractCatalogDeps(sampleCatalog, 'bun');
    expect(result).toEqual([
      {
        depType: 'bun.catalog.default',
        depName: 'react',
        currentValue: '^19.0.0',
        datasource: 'npm',
        prettyDepType: 'bun.catalog.default',
      },
      {
        depType: 'bun.catalog.testing',
        depName: 'jest',
        currentValue: '30.0.0',
        datasource: 'npm',
        prettyDepType: 'bun.catalog.testing',
      },
    ]);
  });

  it('handles empty catalogs list for bun', () => {
    const result = extractCatalogDeps([], 'bun');
    expect(result).toEqual([]);
  });
});
