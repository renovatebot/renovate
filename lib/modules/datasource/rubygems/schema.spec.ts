import { codeBlock } from 'common-tags';
import {
  GemInfo,
  GemMetadata,
  GemVersions,
  MarshalledVersionInfo,
} from './schema';

describe('modules/datasource/rubygems/schema', () => {
  describe('MarshalledVersionInfo', () => {
    it('parses valid input', () => {
      const input = [
        { number: '1.0.0' },
        { number: '2.0.0' },
        { number: '3.0.0' },
      ];
      const output = MarshalledVersionInfo.parse(input);
      expect(output).toEqual({
        releases: [
          { version: '1.0.0' },
          { version: '2.0.0' },
          { version: '3.0.0' },
        ],
      });
    });

    it('errors on empty input', () => {
      expect(() => MarshalledVersionInfo.parse([])).toThrow(
        'Empty response from `/v1/dependencies` endpoint',
      );
    });
  });

  describe('GemMetadata', () => {
    it('parses empty object into undefined fields', () => {
      expect(GemMetadata.parse({})).toEqual({
        changelogUrl: undefined,
        homepage: undefined,
        sourceUrl: undefined,
      });
    });

    it('parses valid input', () => {
      const input = {
        changelog_uri: 'https://example.com',
        homepage_uri: 'https://example.com',
        source_code_uri: 'https://example.com',
      };
      const output = GemMetadata.parse(input);
      expect(output).toEqual({
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
      expect(output).toEqual({
        releases: [
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
        ],
      });
    });
  });

  describe('GemInfo', () => {
    it('parses valid input', () => {
      const input = codeBlock`
        ---
        1.1.1 |checksum:aaa
        2.2.2 |checksum:bbb
        3.3.3 |checksum:ccc
      `;
      const output = GemInfo.parse(input);
      expect(output).toEqual({
        releases: [
          { version: '1.1.1' },
          { version: '2.2.2' },
          { version: '3.3.3' },
        ],
      });
    });

    it('errors on empty input', () => {
      expect(() => GemInfo.parse('')).toThrow(
        'Empty response from `/info` endpoint',
      );
    });
  });
});
