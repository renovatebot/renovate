import type { Catalog } from '../types';
import { extractCatalogDeps } from './catalogs';

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
});
