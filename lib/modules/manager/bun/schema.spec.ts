import { BunCatalogs } from './schema.ts';

describe('modules/manager/bun/schema', () => {
  describe('BunCatalogs', () => {
    it('returns no catalogs for non-object input', () => {
      expect(BunCatalogs.parse(null)).toEqual([]);
    });

    it('drops malformed entries individually', () => {
      expect(
        BunCatalogs.parse({
          catalog: { react: '^19.0.0', broken: 42 },
          catalogs: { testing: { jest: '30.0.0' }, invalid: 'nope' },
        }),
      ).toEqual([
        { name: 'default', dependencies: { react: '^19.0.0' } },
        { name: 'testing', dependencies: { jest: '30.0.0' } },
      ]);
    });
  });
});
