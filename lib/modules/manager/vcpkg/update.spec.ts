import { codeBlock } from 'common-tags';
import { updateDependency } from './update.ts';

const manifest = codeBlock`
  {
    "name": "app",
    "dependencies": [
      "fmt",
      { "name": "zlib", "version>=": "1.2.13#1" }
    ],
    "overrides": [
      { "name": "zlib", "version": "1.2.13", "port-version": 1 },
      { "name": "fmt", "version-semver": "10.0.0" }
    ]
  }
`;

describe('modules/manager/vcpkg/update', () => {
  describe('updateDependency()', () => {
    it('updates the version>= of a dependency', () => {
      const result = updateDependency({
        packageFile: 'vcpkg.json',
        fileContent: manifest,
        upgrade: {
          depName: 'zlib',
          depType: 'dependencies',
          currentValue: '1.2.13#1',
          newValue: '1.3.2#2',
        },
      });
      expect(JSON.parse(result!).dependencies[1]).toEqual({
        name: 'zlib',
        'version>=': '1.3.2#2',
      });
    });

    it('removes the port-version of an override when the new value has none', () => {
      const result = updateDependency({
        packageFile: 'vcpkg.json',
        fileContent: manifest,
        upgrade: {
          depName: 'zlib',
          depType: 'overrides',
          currentValue: '1.2.13#1',
          newValue: '1.3.2',
        },
      });
      expect(result).toContain('{ "name": "zlib", "version": "1.3.2" }');
    });

    it('writes the port-version of an override to its own field', () => {
      const result = updateDependency({
        packageFile: 'vcpkg.json',
        fileContent: manifest,
        upgrade: {
          depName: 'fmt',
          depType: 'overrides',
          currentValue: '10.0.0',
          newValue: '11.0.0#2',
        },
      });
      expect(JSON.parse(result!).overrides[1]).toEqual({
        name: 'fmt',
        'version-semver': '11.0.0',
        'port-version': 2,
      });
    });

    it('removes port-version #0', () => {
      const result = updateDependency({
        packageFile: 'vcpkg.json',
        fileContent: manifest,
        upgrade: {
          depName: 'zlib',
          depType: 'overrides',
          currentValue: '1.2.13#1',
          newValue: '1.3.2#0',
        },
      });
      expect(JSON.parse(result!).overrides[0]).toEqual({
        name: 'zlib',
        version: '1.3.2',
      });
    });

    it.each([
      ['dependencies', '1.2.13#1'],
      ['overrides', '1.2.13#1'],
    ])(
      'returns the file unchanged when the %s entry already has the new value',
      (depType, newValue) => {
        expect(
          updateDependency({
            packageFile: 'vcpkg.json',
            fileContent: manifest,
            upgrade: {
              depName: 'zlib',
              depType,
              currentValue: '1.2.12',
              newValue,
            },
          }),
        ).toBe(manifest);
      },
    );

    it.each([
      ['an unparsable manifest', 'not json', 'overrides', '1.2.13#1'],
      ['a missing dep type', manifest, 'features', '1.2.13#1'],
      ['another current value', manifest, 'overrides', '1.2.12'],
      ['another current lower bound', manifest, 'dependencies', '1.2.12'],
    ])('returns null for %s', (_, fileContent, depType, currentValue) => {
      expect(
        updateDependency({
          packageFile: 'vcpkg.json',
          fileContent,
          upgrade: {
            depName: 'zlib',
            depType,
            currentValue,
            newValue: '1.3.2',
          },
        }),
      ).toBeNull();
    });

    it('returns null for an override without a version', () => {
      expect(
        updateDependency({
          packageFile: 'vcpkg.json',
          fileContent: '{ "overrides": [{ "name": "zlib", "version": "" }] }',
          upgrade: {
            depName: 'zlib',
            depType: 'overrides',
            currentValue: '1.2.13',
            newValue: '1.3.2',
          },
        }),
      ).toBeNull();
    });

    it('returns null without a new value', () => {
      expect(
        updateDependency({
          packageFile: 'vcpkg.json',
          fileContent: manifest,
          upgrade: {
            depName: 'zlib',
            depType: 'overrides',
            currentValue: '1.2.13#1',
          },
        }),
      ).toBeNull();
    });
  });
});
