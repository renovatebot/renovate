import type { ReleaseResult } from '../types';
import {
  ComposerRelease,
  ComposerReleases,
  parsePackagesResponse,
  parsePackagesResponses,
} from './schema';

describe('modules/datasource/packagist/schema', () => {
  describe('ComposerRelease', () => {
    it('rejects', () => {
      expect(() => ComposerRelease.parse(null)).toThrow();
      expect(() => ComposerRelease.parse(undefined)).toThrow();
      expect(() => ComposerRelease.parse('')).toThrow();
      expect(() => ComposerRelease.parse({})).toThrow();
      expect(() => ComposerRelease.parse({ version: null })).toThrow();
      expect(() => ComposerRelease.parse({ version: null })).toThrow();
      expect(() => ComposerRelease.parse({ version: '' })).toThrow();
      expect(() => ComposerRelease.parse({ version: 'dev-main' })).toThrow();
    });

    it('parses', () => {
      expect(ComposerRelease.parse({ version: '1.2.3' })).toEqual({
        version: '1.2.3',
      });

      expect(ComposerRelease.parse({ version: '1.2.3', homepage: 42 })).toEqual(
        { version: '1.2.3', homepage: null }
      );

      expect(
        ComposerRelease.parse({ version: '1.2.3', homepage: 'example.com' })
      ).toEqual({ version: '1.2.3', homepage: 'example.com' });

      expect(
        ComposerRelease.parse({ version: '1.2.3', source: 'nonsense' })
      ).toEqual({ version: '1.2.3', source: null });

      expect(
        ComposerRelease.parse({ version: '1.2.3', source: { url: 'foobar' } })
      ).toEqual({ version: '1.2.3', source: { url: 'foobar' } });

      expect(
        ComposerRelease.parse({ version: '1.2.3', time: '12345' })
      ).toEqual({ version: '1.2.3', time: '12345' });
    });
  });

  describe('ComposerReleases', () => {
    it('rejects', () => {
      expect(() => ComposerReleases.parse(null)).toThrow();
      expect(() => ComposerReleases.parse(undefined)).toThrow();
      expect(() => ComposerReleases.parse('')).toThrow();
      expect(() => ComposerReleases.parse({})).toThrow();
    });

    it('parses', () => {
      expect(ComposerReleases.parse([])).toEqual([]);
      expect(ComposerReleases.parse([null])).toEqual([]);
      expect(ComposerReleases.parse([1, 2, 3])).toEqual([]);
      expect(ComposerReleases.parse(['foobar'])).toEqual([]);
      expect(ComposerReleases.parse([{ version: '1.2.3' }])).toEqual([
        { version: '1.2.3' },
      ]);
    });
  });

  describe('parsePackageResponse', () => {
    it('parses', () => {
      expect(parsePackagesResponse('foo/bar', null)).toEqual([]);
      expect(parsePackagesResponse('foo/bar', {})).toEqual([]);
      expect(parsePackagesResponse('foo/bar', { packages: '123' })).toEqual([]);
      expect(parsePackagesResponse('foo/bar', { packages: {} })).toEqual([]);
      expect(
        parsePackagesResponse('foo/bar', {
          packages: {
            'foo/bar': [{ version: '1.2.3' }],
            'baz/qux': [{ version: '4.5.6' }],
          },
        })
      ).toEqual([{ version: '1.2.3' }]);
    });
  });

  describe('parsePackagesResponses', () => {
    it('parses', () => {
      expect(parsePackagesResponses('foo/bar', [null])).toBeNull();
      expect(parsePackagesResponses('foo/bar', [{}])).toBeNull();
      expect(
        parsePackagesResponses('foo/bar', [{ packages: '123' }])
      ).toBeNull();
      expect(parsePackagesResponses('foo/bar', [{ packages: {} }])).toBeNull();
      expect(
        parsePackagesResponses('foo/bar', [
          {
            packages: {
              'foo/bar': [
                {
                  version: 'v1.1.1',
                  time: '111',
                  homepage: 'https://example.com/1',
                  source: { url: 'git@example.com:foo/bar-1' },
                },
              ],
              'baz/qux': [
                {
                  version: 'v2.2.2',
                  time: '222',
                  homepage: 'https://example.com/2',
                  source: { url: 'git@example.com:baz/qux-2' },
                },
              ],
            },
          },
          {
            packages: {
              'foo/bar': [
                {
                  version: 'v3.3.3',
                  time: '333',
                  homepage: 'https://example.com/3',
                  source: { url: 'git@example.com:foo/bar-3' },
                },
              ],
              'baz/qux': [
                {
                  version: 'v4.4.4',
                  time: '444',
                  homepage: 'https://example.com/4',
                  source: { url: 'git@example.com:baz/qux-3' },
                },
              ],
            },
          },
        ] satisfies { packages: Record<string, ComposerRelease[]> }[])
      ).toEqual({
        homepage: 'https://example.com/3',
        sourceUrl: 'git@example.com:foo/bar-3',
        releases: [
          { version: '1.1.1', gitRef: 'v1.1.1', releaseTimestamp: '111' },
          { version: '3.3.3', gitRef: 'v3.3.3', releaseTimestamp: '333' },
        ],
      } satisfies ReleaseResult);
    });
  });
});
