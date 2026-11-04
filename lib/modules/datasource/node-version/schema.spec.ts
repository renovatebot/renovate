import { NodeRelease, NodeReleases } from './schema.ts';

describe('modules/datasource/node-version/schema', () => {
  describe('NodeRelease', () => {
    it('parses a stable LTS release', () => {
      const result = NodeRelease.parse({
        version: 'v20.0.0',
        date: '2023-04-18',
        lts: 'Iron',
      });
      expect(result.version).toBe('v20.0.0');
      expect(result.lts).toBe('Iron');
    });

    it('parses a non-LTS release', () => {
      const result = NodeRelease.parse({
        version: 'v21.0.0',
        date: '2023-10-17',
        lts: false,
      });
      expect(result.version).toBe('v21.0.0');
      expect(result.lts).toBe(false);
    });
  });

  describe('NodeReleasesSchema', () => {
    it('parses an array of releases, skipping invalid elements', () => {
      const input = [
        { version: 'v20.0.0', date: '2023-04-18', lts: 'Iron' },
        { notARelease: true }, // invalid — missing required fields
        { version: 'v18.0.0', date: '2022-04-19', lts: 'Hydrogen' },
      ];
      const result = NodeReleases.parse(input);
      // invalid element is skipped (LooseArray behavior)
      expect(result).toHaveLength(2);
      expect(result[0].version).toBe('v20.0.0');
      expect(result[1].version).toBe('v18.0.0');
    });
  });
});
