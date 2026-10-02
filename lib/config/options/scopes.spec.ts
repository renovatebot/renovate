import { partial } from '../../../test/util.ts';
import type { RenovateOptions, RenovateStringOption } from '../types.ts';
import {
  describeAllowedLocations,
  getAllowedParents,
  sharedScopes,
} from './scopes.ts';

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

    it('expands the shared scopes to every place per-update config applies', () => {
      const parents = getAllowedParents(option({ scopes: sharedScopes }));

      expect(parents).toContain('.');
      expect(parents).toContain('packageRules');
      // manager(s)
      expect(parents).toContain('npm');
      expect(parents).toContain('mise');
      // `updateType`s
      expect(parents).toContain('major');
      expect(parents).toContain('vulnerabilityAlerts');
      expect(parents).toContain('group');
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

    it('expands the `any` scope to every object a config nests in', () => {
      const parents = getAllowedParents(option({ scopes: ['any'] }));

      expect(parents).toContain('.');
      expect(parents).toContain('packageRules');
      // manager(s)
      expect(parents).toContain('npm');
      // `updateType`s
      expect(parents).toContain('major');
      // the objects which aren't a scope of their own
      expect(parents).toContain('hostRules');
      expect(parents).toContain('customManagers');
      expect(parents).toContain('postUpgradeTasks');
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
