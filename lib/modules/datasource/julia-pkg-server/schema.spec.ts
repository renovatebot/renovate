import { Package, Versions } from './schema';

describe('modules/datasource/julia-pkg-server/schema', () => {
  describe('Metadata', () => {
    it('parses valid input', () => {
      const expectedUrl = 'https://example.com';

      const input = `repo = "${expectedUrl}"`;

      const output = Package.parse(input);

      expect(output).toEqual({
        sourceUrl: expectedUrl,
      });
    });

    it('parses empty input', () => {
      // Empty inputs are valid given that all relevant information for
      // Renovate is optional
      const output = Package.parse('');
      expect(output).toEqual({});
    });
  });

  describe('Versions', () => {
    it('parses valid input', () => {
      const input = `
      ["0.1.0"]

      ["0.2.0"]
      yanked = true
      `;

      const output = Versions.parse(input);

      expect(output).toEqual({
        releases: [
          { version: '0.1.0' },
          { isDeprecated: true, version: '0.2.0' },
        ],
      });
    });

    it('errors on empty input', () => {
      // A package cannot be published to a registry if it does not have any
      // versions
      expect(() => Versions.parse('')).toThrow('No versions available');
    });
  });
});
