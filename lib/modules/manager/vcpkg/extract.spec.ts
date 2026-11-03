import { codeBlock } from 'common-tags';
import { extractPackageFile } from './extract.ts';

describe('modules/manager/vcpkg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid JSON', () => {
      expect(extractPackageFile('not { valid json', 'vcpkg.json')).toBeNull();
    });

    it('returns null when the manifest does not match the schema', () => {
      expect(
        extractPackageFile('{"dependencies": "oops"}', 'vcpkg.json'),
      ).toBeNull();
    });

    it('returns null without dependencies or overrides', () => {
      const content = codeBlock`
        {
          "name": "demo",
          "version-string": "1.0",
          "dependencies": [],
          "overrides": []
        }
      `;

      expect(extractPackageFile(content, 'vcpkg.json')).toBeNull();
    });

    it('extracts dependencies and overrides', () => {
      const content = codeBlock`
        {
          "name": "example",
          "version-semver": "1.0.0",
          "dependencies": [
            "bare-port",
            { "name": "zlib", "version>=": "1.2.13" },
            { "name": "feature-gated", "features": ["one"], "default-features": false },
            { "name": "openssl", "version>=": "3.0.0", "platform": "linux", "host": true }
          ],
          "overrides": [
            { "name": "fmt", "version": "9.1.0" },
            { "name": "boost", "version-semver": "1.81.0", "port-version": 2 },
            { "name": "ffmpeg", "version-date": "2023-01-15" },
            { "name": "legacy", "version-string": "rolling" },
            { "name": "zero-port", "version": "1.0.0", "port-version": 0 },
            { "name": "no-version" }
          ]
        }
      `;

      expect(extractPackageFile(content, 'vcpkg.json')).toEqual({
        packageFileVersion: '1.0.0',
        deps: [
          {
            depName: 'bare-port',
            depType: 'dependencies',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
            skipReason: 'unspecified-version',
          },
          {
            depName: 'zlib',
            depType: 'dependencies',
            currentValue: '1.2.13',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
          {
            depName: 'feature-gated',
            depType: 'dependencies',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
            skipReason: 'unspecified-version',
          },
          {
            depName: 'openssl',
            depType: 'dependencies',
            currentValue: '3.0.0',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
          {
            depName: 'fmt',
            depType: 'overrides',
            currentValue: '9.1.0',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
          {
            depName: 'boost',
            depType: 'overrides',
            currentValue: '1.81.0#2',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
          {
            depName: 'ffmpeg',
            depType: 'overrides',
            currentValue: '2023-01-15',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
          {
            depName: 'legacy',
            depType: 'overrides',
            currentValue: 'rolling',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
          {
            depName: 'zero-port',
            depType: 'overrides',
            currentValue: '1.0.0',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
        ],
      });
    });

    it('extracts overrides without dependencies', () => {
      const content = codeBlock`
        { "overrides": [{ "name": "fmt", "version": "9.1.0" }] }
      `;

      expect(extractPackageFile(content, 'vcpkg.json')).toEqual({
        deps: [
          {
            depName: 'fmt',
            depType: 'overrides',
            currentValue: '9.1.0',
            datasource: 'vcpkg',
            versioning: 'vcpkg',
          },
        ],
      });
    });

    it.each`
      field               | value
      ${'version'}        | ${'1'}
      ${'version-semver'} | ${'1.0.0'}
      ${'version-date'}   | ${'2024-01-01'}
      ${'version-string'} | ${'rolling'}
    `('takes packageFileVersion from $field', ({ field, value }) => {
      const content = JSON.stringify({
        [field]: value,
        dependencies: ['only-dep'],
      });

      expect(
        extractPackageFile(content, 'vcpkg.json')?.packageFileVersion,
      ).toBe(value);
    });

    it('omits packageFileVersion when none is declared', () => {
      const content = JSON.stringify({ dependencies: ['only-dep'] });

      expect(
        extractPackageFile(content, 'vcpkg.json')?.packageFileVersion,
      ).toBeUndefined();
    });
  });
});
