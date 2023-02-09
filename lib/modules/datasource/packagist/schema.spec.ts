import type { ReleaseResult } from '../types';
import {
  ComposerRelease,
  ComposerReleasesArray,
  ComposerReleasesRecord,
  MinifiedArray,
  parsePackagesResponse,
  parsePackagesResponses,
} from './schema';

describe('modules/datasource/packagist/schema', () => {
  describe('MinifiedArray', () => {
    it('parses MinifiedArray', () => {
      expect(MinifiedArray.parse([])).toEqual([]);

      // Source: https://github.com/composer/metadata-minifier/blob/1.0.0/tests/MetadataMinifierTest.php
      expect(
        MinifiedArray.parse([
          {
            name: 'foo/bar',
            version: '2.0.0',
            version_normalized: '2.0.0.0',
            type: 'library',
            scripts: {
              foo: 'bar',
            },
            license: ['MIT'],
          },
          {
            version: '1.2.0',
            version_normalized: '1.2.0.0',
            license: ['GPL'],
            homepage: 'https://example.org',
            scripts: '__unset',
          },
          {
            version: '1.0.0',
            version_normalized: '1.0.0.0',
            homepage: '__unset',
          },
        ])
      ).toEqual([
        {
          name: 'foo/bar',
          version: '2.0.0',
          version_normalized: '2.0.0.0',
          type: 'library',
          scripts: {
            foo: 'bar',
          },
          license: ['MIT'],
        },
        {
          name: 'foo/bar',
          version: '1.2.0',
          version_normalized: '1.2.0.0',
          type: 'library',
          license: ['GPL'],
          homepage: 'https://example.org',
        },
        {
          name: 'foo/bar',
          version: '1.0.0',
          version_normalized: '1.0.0.0',
          type: 'library',
          license: ['GPL'],
        },
      ]);
    });
  });

  describe('ComposerRelease', () => {
    it('rejects ComposerRelease', () => {
      expect(() => ComposerRelease.parse(null)).toThrow();
      expect(() => ComposerRelease.parse(undefined)).toThrow();
      expect(() => ComposerRelease.parse('')).toThrow();
      expect(() => ComposerRelease.parse({})).toThrow();
      expect(() => ComposerRelease.parse({ version: null })).toThrow();
      expect(() => ComposerRelease.parse({ version: null })).toThrow();
    });

    it('parses ComposerRelease', () => {
      expect(ComposerRelease.parse({ version: '' })).toEqual({ version: '' });
      expect(ComposerRelease.parse({ version: 'dev-main' })).toEqual({
        version: 'dev-main',
      });

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

  describe('ComposerReleasesArray', () => {
    it('rejects ComposerReleasesArray', () => {
      expect(() => ComposerReleasesArray.parse(null)).toThrow();
      expect(() => ComposerReleasesArray.parse(undefined)).toThrow();
      expect(() => ComposerReleasesArray.parse('')).toThrow();
      expect(() => ComposerReleasesArray.parse({})).toThrow();
    });

    it('parses ComposerReleasesArray', () => {
      expect(ComposerReleasesArray.parse([])).toEqual([]);
      expect(ComposerReleasesArray.parse([null])).toEqual([]);
      expect(ComposerReleasesArray.parse([1, 2, 3])).toEqual([]);
      expect(ComposerReleasesArray.parse(['foobar'])).toEqual([]);
      expect(
        ComposerReleasesArray.parse([
          { version: '1.2.3' },
          { version: 'dev-main' },
        ])
      ).toEqual([{ version: '1.2.3' }, { version: 'dev-main' }]);
    });
  });

  describe('ComposerReleasesRecord', () => {
    it('rejects ComposerReleasesRecord', () => {
      expect(() => ComposerReleasesRecord.parse(null)).toThrow();
      expect(() => ComposerReleasesRecord.parse(undefined)).toThrow();
      expect(() => ComposerReleasesRecord.parse('')).toThrow();
      expect(() => ComposerReleasesRecord.parse([])).toThrow();
    });

    it('parses ComposerReleasesRecord', () => {
      expect(ComposerReleasesRecord.parse({})).toEqual({});
      expect(ComposerReleasesRecord.parse({ foo: null })).toEqual({});
      expect(ComposerReleasesRecord.parse({ foo: 1, bar: 2, baz: 3 })).toEqual(
        {}
      );
      expect(ComposerReleasesRecord.parse({ foo: 'bar' })).toEqual({});
      expect(
        ComposerReleasesRecord.parse({
          '0.0.1': { foo: 'bar' },
          '0.0.2': { version: '0.0.1' },
          '1.2.3': { version: '1.2.3' },
          'dev-main': { version: 'dev-main' },
        })
      ).toEqual({
        '1.2.3': { version: '1.2.3' },
        'dev-main': { version: 'dev-main' },
      });
    });
  });

  describe('parsePackageResponse', () => {
    it('parses package response', () => {
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

    it('expands minified fields', () => {
      expect(
        parsePackagesResponse('foo/bar', {
          packages: {
            'foo/bar': [
              { version: '3.3.3', require: { php: '^8.0' } },
              { version: '2.2.2' },
              { version: '1.1.1' },
              { version: '0.0.4', require: { php: '^7.0' } },
              { version: '0.0.3' },
              { version: '0.0.2', require: '__unset' },
              { version: '0.0.1' },
            ],
          },
        })
      ).toEqual([
        { version: '3.3.3', require: { php: '^8.0' } },
        { version: '2.2.2', require: { php: '^8.0' } },
        { version: '1.1.1', require: { php: '^8.0' } },
        { version: '0.0.4', require: { php: '^7.0' } },
        { version: '0.0.3', require: { php: '^7.0' } },
        { version: '0.0.2' },
        { version: '0.0.1' },
      ] satisfies ComposerRelease[]);
    });
  });

  describe('parsePackagesResponses', () => {
    it('parses array of responses', () => {
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
                  require: { php: '^8.0' },
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
                  require: { php: '^7.0' },
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
        homepage: 'https://example.com/1',
        sourceUrl: 'git@example.com:foo/bar-1',
        releases: [
          {
            version: '1.1.1',
            gitRef: 'v1.1.1',
            releaseTimestamp: '111',
            constraints: { php: ['^8.0'] },
          },
          {
            version: '3.3.3',
            gitRef: 'v3.3.3',
            releaseTimestamp: '333',
            constraints: { php: ['^7.0'] },
          },
        ],
      } satisfies ReleaseResult);
    });
  });
});
