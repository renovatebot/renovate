import { parseManifestUrl } from './parse.ts';

describe('modules/datasource/rust-version/parse', () => {
  describe('parseManifestUrl', () => {
    it('parses nightly URL', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2025-11-24/channel-rust-nightly.toml',
      );
      expect(result).toEqual({
        date: '2025-11-24',
        version: 'nightly',
      });
    });

    it('parses versioned release URL', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2024-10-17/channel-rust-1.82.0.toml',
      );
      expect(result).toEqual({
        date: '2024-10-17',
        version: '1.82.0',
      });
    });

    it('parses beta versioned URL', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2025-01-15/channel-rust-1.83.0-beta.5.toml',
      );
      expect(result).toEqual({
        date: '2025-01-15',
        version: '1.83.0-beta.5',
      });
    });

    it('parses stable channel URL', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2025-11-24/channel-rust-stable.toml',
      );
      expect(result).toEqual({
        date: '2025-11-24',
        version: 'stable',
      });
    });

    it('parses beta channel URL', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2025-11-24/channel-rust-beta.toml',
      );
      expect(result).toEqual({
        date: '2025-11-24',
        version: 'beta',
      });
    });

    it('parses URL with https protocol', () => {
      const result = parseManifestUrl(
        'https://static.rust-lang.org/dist/2025-11-24/channel-rust-nightly.toml',
      );
      expect(result).toEqual({
        date: '2025-11-24',
        version: 'nightly',
      });
    });

    it('parses URL with http protocol', () => {
      const result = parseManifestUrl(
        'http://static.rust-lang.org/dist/2025-11-24/channel-rust-nightly.toml',
      );
      expect(result).toEqual({
        date: '2025-11-24',
        version: 'nightly',
      });
    });

    it('returns null for URL without date', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/channel-rust-nightly.toml',
      );
      expect(result).toBeNull();
    });

    it('returns null for URL without channel-rust pattern', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2025-11-24/something-else.toml',
      );
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = parseManifestUrl('');
      expect(result).toBeNull();
    });

    it('returns null for malformed date', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2025-13-45/channel-rust-nightly.toml',
      );
      expect(result).toEqual({
        date: '2025-13-45',
        version: 'nightly',
      });
    });

    it('parses URL with different domain', () => {
      const result = parseManifestUrl(
        'example.com/archives/2025-11-24/channel-rust-1.82.0.toml',
      );
      expect(result).toEqual({
        date: '2025-11-24',
        version: '1.82.0',
      });
    });

    it('parses URL with complex version', () => {
      const result = parseManifestUrl(
        'static.rust-lang.org/dist/2020-06-18/channel-rust-1.44.1.toml',
      );
      expect(result).toEqual({
        date: '2020-06-18',
        version: '1.44.1',
      });
    });
  });
});
