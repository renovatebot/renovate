import { extractSwiftToolsVersion } from './util';

describe('modules/manager/swift/util', () => {
  describe('extractSwiftToolsVersion()', () => {
    it('extracts 2-part version', () => {
      expect(extractSwiftToolsVersion('// swift-tools-version:5.0')).toBe(
        '5.0'
      );
    });

    it('extracts 3-part version', () => {
      expect(extractSwiftToolsVersion('// swift-tools-version:5.1.2')).toBe(
        '5.1.2'
      );
    });

    it('ignores pre-release, build version and reserved components', () => {
      expect(
        extractSwiftToolsVersion('// swift-tools-version:5.1.2-foo+bar;foobar')
      ).toBe('5.1.2');
    });

    it('truncates invalid versions with a valid prefix', () => {
      expect(
        extractSwiftToolsVersion('// swift-tools-version:5.1.2.3.4.')
      ).toBe('5.1.2');
    });

    it('no whitespace is required', () => {
      expect(extractSwiftToolsVersion('//swift-tools-version:5.1.2')).toBe(
        '5.1.2'
      );
    });

    it('allows extra whitespace', () => {
      expect(
        extractSwiftToolsVersion(' \t // \t swift-tools-version: \t 5.1.2 \t ')
      ).toBe('5.1.2');
    });

    it('allows blank preceding lines', () => {
      expect(extractSwiftToolsVersion('\n\n// swift-tools-version:5.1.2')).toBe(
        '5.1.2'
      );
    });

    it('returns null if tools version is not at the start of the file', () => {
      expect(
        extractSwiftToolsVersion('foo\n// swift-tools-version:5.1.2')
      ).toBeNull();
    });

    it('returns null if version is not at least 2-part', () => {
      expect(extractSwiftToolsVersion('// swift-tools-version:5')).toBeNull();
    });

    it('returns null if preamble is not correct', () => {
      expect(extractSwiftToolsVersion('// swift-tool-version:5.0')).toBeNull();
    });
  });
});
