import { partial } from '../../../test/util.ts';
import type { RenovateOptions, RenovateStringOption } from '../types.ts';
import { describeAllowedLocations, getAllowedParents } from './scopes.ts';

function option(overrides: Partial<RenovateStringOption>): RenovateOptions {
  return partial<RenovateStringOption>({
    name: 'anOption',
    description: 'A description',
    type: 'string',
    ...overrides,
  });
}

describe('config/options/scopes', () => {
  describe('getAllowedParents', () => {
    it('returns undefined when an option declares neither', () => {
      expect(getAllowedParents(option({}))).toBeUndefined();
    });

    it('returns the parents an option names', () => {
      expect(getAllowedParents(option({ parents: ['hostRules'] }))).toEqual([
        'hostRules',
      ]);
    });

    it('expands a scope to the objects it covers', () => {
      expect(
        getAllowedParents(option({ scopes: ['repo', 'packageRule'] })),
      ).toEqual(['.', 'packageRules']);
    });

    it('expands the manager and update type scopes', () => {
      const parents = getAllowedParents(
        option({ scopes: ['manager', 'updateType'] }),
      );

      expect(parents).toContain('npm');
      expect(parents).toContain('gomod');
      expect(parents).toContain('major');
      expect(parents).toContain('lockFileMaintenance');
      expect(parents).not.toContain('.');
    });

    it('combines parents and scopes without duplicates', () => {
      expect(
        getAllowedParents(
          option({ parents: ['.', 'packageRules'], scopes: ['packageRule'] }),
        ),
      ).toEqual(['.', 'packageRules']);
    });
  });

  describe('describeAllowedLocations', () => {
    it('returns undefined for an option which can be used anywhere', () => {
      expect(describeAllowedLocations(option({}))).toBeUndefined();
    });

    it('describes a single scope', () => {
      expect(
        describeAllowedLocations(option({ scopes: ['packageRule'] })),
      ).toBe('in a `packageRules` entry');
    });

    it('describes each scope an option can be used in', () => {
      expect(
        describeAllowedLocations(
          option({ scopes: ['repo', 'packageRule', 'manager', 'updateType'] }),
        ),
      ).toBe(
        "at the top level of a config, in a `packageRules` entry, in a manager's config or in an update type's config",
      );
    });

    it('describes the objects an option names, sorted', () => {
      expect(
        describeAllowedLocations(
          option({ parents: ['.', 'postUpgradeTasks', 'hostRules'] }),
        ),
      ).toBe(
        'at the top level of a config or in `hostRules` or `postUpgradeTasks`',
      );
    });
  });
});
