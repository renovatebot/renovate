import { VersionInfoSchema } from './schema.ts';

describe('modules/datasource/go/schema', () => {
  describe('VersionInfoSchema', () => {
    it('parses a valid version info response', () => {
      const result = VersionInfoSchema.parse({
        Version: 'v1.2.3',
        Time: '2021-01-01T00:00:00Z',
      });
      expect(result.Version).toBe('v1.2.3');
      expect(result.Time).toBe('2021-01-01T00:00:00Z');
    });

    it('parses a response without Time field', () => {
      const result = VersionInfoSchema.parse({ Version: 'v1.0.0' });
      expect(result.Version).toBe('v1.0.0');
      expect(result.Time).toBeUndefined();
    });

    it('ignores extra fields', () => {
      const result = VersionInfoSchema.parse({
        Version: 'v2.0.0',
        Time: '2022-06-01T00:00:00Z',
        Origin: { VCS: 'git' }, // extra field
      });
      expect(result.Version).toBe('v2.0.0');
    });

    it('throws on missing required Version field', () => {
      expect(() => VersionInfoSchema.parse({ Time: '2022-01-01' })).toThrow();
    });
  });
});
