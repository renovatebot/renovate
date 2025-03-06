import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOptions } from '../../config/options';
import { loadModules } from '../../util/modules';
import { registry } from '../../util/registry';
import { asTimestamp } from '../../util/timestamp';
import type { ReleaseResult } from '../datasource/types';
import { isVersioningApiConstructor } from './common';
import type { GenericVersion } from './generic';
import { GenericVersioningApi } from './generic';
import * as semverVersioning from './semver';
import * as semverCoercedVersioning from './semver-coerced';
import type { VersioningApi, VersioningApiConstructor } from './types';
import * as allVersioning from '.';
import { getNewValue } from './index';

const supportedSchemes = getOptions().find(
  (option) => option.name === 'versioning',
)?.allowedValues;

describe('modules/versioning/index', () => {
  it('has api', () => {
    expect(Object.keys(allVersioning.get('semver')).sort()).toEqual([
      'equals',
      'getMajor',
      'getMinor',
      'getNewValue',
      'getPatch',
      'getSatisfyingVersion',
      'isCompatible',
      'isGreaterThan',
      'isLessThanRange',
      'isSingleVersion',
      'isStable',
      'isValid',
      'isVersion',
      'matches',
      'minSatisfyingVersion',
      'sortVersions',
    ]);
  });

  it('validates', async () => {
    function validate(
      module: VersioningApi | VersioningApiConstructor,
      name: string,
    ): boolean {
      const mod = isVersioningApiConstructor(module) ? new module() : module;

      // TODO: test required api (#9715)
      if (!mod.isValid || !mod.isVersion) {
        throw Error(`Missing api on ${name}`);
      }

      return true;
    }
    const vers = allVersioning.getVersionings();

    const loadedVers = await loadModules(__dirname);
    expect(Array.from(vers.keys())).toEqual(Object.keys(loadedVers));

    for (const name of vers.keys()) {
      const ver = vers.get(name)!;
      expect(validate(ver, name)).toBeTrue();
    }
  });

  it('should fallback to semver-coerced', () => {
    expect(allVersioning.get(undefined)).toBe(
      allVersioning.get(semverCoercedVersioning.id),
    );
    expect(allVersioning.get('unknown')).toBe(
      allVersioning.get(semverCoercedVersioning.id),
    );
  });

  it('should accept config', () => {
    expect(allVersioning.get('semver:test')).toBeDefined();
  });

  describe('should return the same interface', () => {
    const optionalFunctions = [
      'allowUnstableMajorUpgrades',
      'isLessThanRange',
      'valueToVersion',
      'constructor',
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'should',
      'toLocaleString',
      'toString',
      'valueOf',
      'subset',
      'isSame',
    ];
    const npmApi = Object.keys(allVersioning.get(semverVersioning.id))
      .filter((val) => !optionalFunctions.includes(val))
      .sort();

    function getAllPropertyNames(obj: any): string[] {
      const props: string[] = [];
      let o = obj;

      do {
        Object.getOwnPropertyNames(o).forEach((prop) => {
          if (!props.includes(prop)) {
            props.push(prop);
          }
        });
      } while ((o = Object.getPrototypeOf(o)));

      return props;
    }

    for (const supportedScheme of supportedSchemes ?? []) {
      // eslint-disable-next-line vitest/valid-title
      it(supportedScheme, async () => {
        const schemeKeys = getAllPropertyNames(
          allVersioning.get(supportedScheme),
        )
          .filter(
            (val) => !optionalFunctions.includes(val) && !val.startsWith('_'),
          )
          .sort();

        expect(schemeKeys).toEqual(npmApi);

        const apiOrCtor = (await import(`./${supportedScheme}/index.ts`)).api;
        if (isVersioningApiConstructor(apiOrCtor)) {
          return;
        }

        expect(Object.keys(apiOrCtor).sort()).toEqual(
          Object.keys(allVersioning.get(supportedScheme)).sort(),
        );
      });
    }

    it('dummy', () => {
      class DummyScheme extends GenericVersioningApi {
        protected override _compare(_version: string, _other: string): number {
          throw new Error('Method not implemented.');
        }

        protected _parse(_version: string): GenericVersion {
          throw new Error('Method not implemented.');
        }
      }

      const api = new DummyScheme();
      const schemeKeys = getAllPropertyNames(api)
        .filter(
          (val) => !optionalFunctions.includes(val) && !val.startsWith('_'),
        )
        .sort();

      expect(schemeKeys).toEqual(npmApi);
    });
  });

  describe('version selection', () => {
    // Mock the package registry response
    const mockVersions: ReleaseResult = {
      releases: [
        {
          version: '1.0.0',
          releaseTimestamp: asTimestamp('2021-01-01T00:00:00.000Z')!,
        },
        {
          version: '2.0.0',
          releaseTimestamp: asTimestamp('2021-06-01T00:00:00.000Z')!,
        },
        {
          version: '3.0.0',
          releaseTimestamp: asTimestamp('2022-01-01T00:00:00.000Z')!,
        },
        {
          version: '4.0.0',
          releaseTimestamp: asTimestamp('2022-06-01T00:00:00.000Z')!,
        },
      ],
      sourceUrl: '',
      homepage: '',
      registryUrl: '',
    };

    beforeEach(() => {
      // Mock the registry lookup using Vitest's vi
      vi.spyOn(registry, 'getPkgReleases').mockResolvedValue(mockVersions);
    });

    it('should select n-1 version relative to latest', async () => {
      const config = {
        versioning: 'semver',
        constraints: {
          allowedVersions: '<=${latestVersion}',
          offset: -1,
        },
      };

      const result = await getNewValue({
        currentValue: '2.0.0',
        rangeStrategy: 'replace',
        currentVersion: '2.0.0',
        config,
      });

      expect(result).toBe('3.0.0');
    });

    it('should handle n-1 when new versions are published', async () => {
      // Simulate a new version being published
      mockVersions.releases.push({
        version: '5.0.0',
        releaseTimestamp: asTimestamp('2023-01-01T00:00:00.000Z')!,
      });

      const config = {
        versioning: 'semver',
        constraints: {
          allowedVersions: '<=${latestVersion}',
          offset: -1,
        },
      };

      const result = await getNewValue({
        currentValue: '3.0.0',
        rangeStrategy: 'replace',
        currentVersion: '3.0.0',
        config,
      });

      // Should select version 4.0.0 since it's n-1 from new latest (5.0.0)
      expect(result).toBe('4.0.0');
    });

    it('should handle multiple version offsets', async () => {
      const config = {
        versioning: 'semver',
        constraints: {
          allowedVersions: '<=${latestVersion}',
          offset: -2, // Test n-2 scenario
        },
      };

      const result = await getNewValue({
        currentValue: '2.0.0',
        rangeStrategy: 'replace',
        currentVersion: '2.0.0',
        config,
      });

      // Should select version 2.0.0 since it's n-2 from latest (4.0.0)
      expect(result).toBe('2.0.0');
    });

    it('should handle pre-release versions correctly', async () => {
      mockVersions.releases.push({
        version: '4.1.0-beta.1',
        releaseTimestamp: asTimestamp('2023-02-01T00:00:00.000Z')!,
      });

      const config = {
        versioning: 'semver',
        constraints: {
          allowedVersions: '<=${latestVersion}',
          offset: -1,
          ignorePrerelease: true, // Should ignore pre-release when calculating n-1
        },
      };

      const result = await getNewValue({
        currentValue: '3.0.0',
        rangeStrategy: 'replace',
        currentVersion: '3.0.0',
        config,
      });

      // Should still select 3.0.0 since 4.1.0-beta.1 is a pre-release
      expect(result).toBe('3.0.0');
    });
  });
});
