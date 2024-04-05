import { getOptions } from '../../config/options';
import { loadModules } from '../../util/modules';
import { isVersioningApiConstructor } from './common';
import { GenericVersion, GenericVersioningApi } from './generic';
import * as semverVersioning from './semver';
import * as semverCoercedVersioning from './semver-coerced';
import type { VersioningApi, VersioningApiConstructor } from './types';
import * as allVersioning from '.';

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

  it('validates', () => {
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

    const loadedVers = loadModules(__dirname);
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
      it(supportedScheme, async () => {
        const schemeKeys = getAllPropertyNames(
          allVersioning.get(supportedScheme),
        )
          .filter(
            (val) => !optionalFunctions.includes(val) && !val.startsWith('_'),
          )
          .sort();

        expect(schemeKeys).toEqual(npmApi);

        const apiOrCtor = (await import(`./${supportedScheme}`)).api;
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
});
