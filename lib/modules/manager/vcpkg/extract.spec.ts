import { Fixtures } from '~test/fixtures.ts';
import { extractPackageFile } from './extract.ts';

const vcpkgJson = Fixtures.get('vcpkg.json');

describe('modules/manager/vcpkg/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for unparseable JSON', () => {
      expect(extractPackageFile('not { valid json', 'vcpkg.json')).toBeNull();
    });

    it('returns null when the manifest does not match the schema', () => {
      expect(
        extractPackageFile('{"dependencies": "oops"}', 'vcpkg.json'),
      ).toBeNull();
    });

    it('returns null when there are no dependencies and no overrides', () => {
      const content = '{"name": "demo", "version-string": "1.0"}';
      expect(extractPackageFile(content, 'vcpkg.json')).toBeNull();
    });

    it('returns null when dependencies and overrides are both empty arrays', () => {
      const content = '{"dependencies": [], "overrides": []}';
      expect(extractPackageFile(content, 'vcpkg.json')).toBeNull();
    });

    it('extracts every dependency and override variant from the fixture', () => {
      const res = extractPackageFile(vcpkgJson, 'vcpkg.json');
      expect(res).toEqual({
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

    it('skips override entries that lack every version key', () => {
      const content = JSON.stringify({
        overrides: [{ name: 'no-version' }, { name: 'fmt', version: '9.1.0' }],
      });
      const res = extractPackageFile(content, 'vcpkg.json');
      expect(res?.deps).toEqual([
        {
          depName: 'fmt',
          depType: 'overrides',
          currentValue: '9.1.0',
          datasource: 'vcpkg',
          versioning: 'vcpkg',
        },
      ]);
    });

    it('falls back across packageFileVersion keys', () => {
      const cases: { input: Record<string, unknown>; expected: string }[] = [
        { input: { version: '1' }, expected: '1' },
        { input: { 'version-semver': '1.0.0' }, expected: '1.0.0' },
        { input: { 'version-date': '2024-01-01' }, expected: '2024-01-01' },
        { input: { 'version-string': 'rolling' }, expected: 'rolling' },
      ];
      for (const { input, expected } of cases) {
        const content = JSON.stringify({
          ...input,
          dependencies: ['only-dep'],
        });
        const res = extractPackageFile(content, 'vcpkg.json');
        expect(res?.packageFileVersion).toBe(expected);
      }
    });

    it('omits packageFileVersion when none is declared', () => {
      const content = JSON.stringify({ dependencies: ['only-dep'] });
      const res = extractPackageFile(content, 'vcpkg.json');
      expect(res?.packageFileVersion).toBeUndefined();
      expect(res?.deps).toHaveLength(1);
    });
  });
});
