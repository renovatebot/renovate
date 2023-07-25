import { GemMetadata, GemVersions, MarshalledVersionInfo } from './schema';

describe('modules/datasource/rubygems/schema', () => {
  describe('MarshalledVersionInfo', () => {
    it('parses valid input', () => {
      const input = [
        { number: '1.0.0' },
        { number: '2.0.0' },
        { number: '3.0.0' },
      ];
      const output = MarshalledVersionInfo.parse(input);
      expect(output).toEqual([
        { version: '1.0.0' },
        { version: '2.0.0' },
        { version: '3.0.0' },
      ]);
    });
  });

  describe('GemMetadata', () => {
    it('requires only name field', () => {
      const input = { name: 'foo' };
      const output = GemMetadata.parse(input);
      expect(output).toEqual({
        packageName: 'foo',
        changelogUrl: undefined,
        homepage: undefined,
        latestVersion: undefined,
        sourceUrl: undefined,
      });
    });

    it('parses valid input', () => {
      const input = {
        name: 'foo',
        version: '1.0.0',
        changelog_uri: 'https://example.com',
        homepage_uri: 'https://example.com',
        source_code_uri: 'https://example.com',
      };
      const output = GemMetadata.parse(input);
      expect(output).toEqual({
        packageName: 'foo',
        latestVersion: '1.0.0',
        changelogUrl: 'https://example.com',
        homepage: 'https://example.com',
        sourceUrl: 'https://example.com',
      });
    });
  });

  describe('GemVersions', () => {
    it('parses valid input', () => {
      const input = [
        {
          number: '1.0.0',
          created_at: '2021-01-01',
          platform: 'ruby',
          ruby_version: '2.7.0',
          rubygems_version: '3.2.0',
          metadata: {
            changelog_uri: 'https://example.com',
            source_code_uri: 'https://example.com',
          },
        },
        {
          number: '2.0.0',
          created_at: '2022-01-01',
          platform: 'ruby',
          ruby_version: '2.7.0',
          rubygems_version: '3.2.0',
          metadata: {
            changelog_uri: 'https://example.com',
            source_code_uri: 'https://example.com',
          },
        },
        {
          number: '3.0.0',
          created_at: '2023-01-01',
          platform: 'ruby',
          ruby_version: '2.7.0',
          rubygems_version: '3.2.0',
          metadata: {
            changelog_uri: 'https://example.com',
            source_code_uri: 'https://example.com',
          },
        },
      ];
      const output = GemVersions.parse(input);
      expect(output).toEqual([
        {
          version: '1.0.0',
          releaseTimestamp: '2021-01-01',
          changelogUrl: 'https://example.com',
          sourceUrl: 'https://example.com',
          constraints: {
            platform: ['ruby'],
            ruby: ['2.7.0'],
            rubygems: ['3.2.0'],
          },
        },
        {
          version: '2.0.0',
          releaseTimestamp: '2022-01-01',
          changelogUrl: 'https://example.com',
          sourceUrl: 'https://example.com',
          constraints: {
            platform: ['ruby'],
            ruby: ['2.7.0'],
            rubygems: ['3.2.0'],
          },
        },
        {
          version: '3.0.0',
          releaseTimestamp: '2023-01-01',
          changelogUrl: 'https://example.com',
          sourceUrl: 'https://example.com',
          constraints: {
            platform: ['ruby'],
            ruby: ['2.7.0'],
            rubygems: ['3.2.0'],
          },
        },
      ]);
    });
  });
});
